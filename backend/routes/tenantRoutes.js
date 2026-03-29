import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import crypto from "crypto";
import Tenant from "../models/Tenant.js";
import Building from "../models/Building.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// ── In-memory short-token store ──────────────────────────────────────────────
// Maps  shortCode → { jwtToken, expiresAt }
// For production, store in Redis or a DB collection instead.
const shortTokenStore = new Map();

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of shortTokenStore.entries()) {
    if (v.expiresAt < now) shortTokenStore.delete(k);
  }
}, 60 * 60 * 1000); // clean every hour

// Configure Cloudinary
let upload;

try {
  if (process.env.CLOUDINARY_CLOUD_NAME && 
      process.env.CLOUDINARY_API_KEY && 
      process.env.CLOUDINARY_API_SECRET) {
    
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
      api_key: process.env.CLOUDINARY_API_KEY.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
    });
    
    console.log("✅ Cloudinary configured");
    
    const storage = multer.memoryStorage();
    upload = multer({ 
      storage: storage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
          return cb(null, true);
        }
        cb(new Error("Only images and PDF files are allowed"));
      }
    });
  } else {
    console.warn("⚠️ Cloudinary credentials missing");
    upload = multer({ 
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }
    });
  }
} catch (error) {
  console.error("❌ Error configuring upload:", error);
  upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
  });
}

// Helper function to upload file to Cloudinary
const uploadToCloudinary = async (fileBuffer, folder) => {
  if (!fileBuffer) return null;
  
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: "auto",
        allowed_formats: ["jpg", "jpeg", "png", "pdf"],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided." });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token." });
  }
};

// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────

// Generate a SHORT onboarding link (8-char code instead of full JWT in URL)
router.get("/generate-link", auth, (req, res) => {
  // Full JWT stored server-side, only a short code goes in the URL
  const jwtToken = jwt.sign(
    { id: req.user.id, purpose: "tenant-registration" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  // 8-character alphanumeric short code
  const shortCode = crypto.randomBytes(5).toString("base64url").slice(0, 8);
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  shortTokenStore.set(shortCode, { jwtToken, expiresAt });

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const link = `${frontendUrl}/tenant-register/${shortCode}`;

  res.json({ link, expiresIn: "7 days" });
});

// Validate a short code (or legacy full JWT — backwards compatible)
router.get("/validate-link/:token", async (req, res) => {
  try {
    let decoded;
    const raw = req.params.token;

    // Short code path (≤ 12 chars)
    if (raw.length <= 12) {
      const entry = shortTokenStore.get(raw);
      if (!entry || entry.expiresAt < Date.now()) {
        return res.status(401).json({ message: "Link is invalid or has expired." });
      }
      decoded = jwt.verify(entry.jwtToken, process.env.JWT_SECRET);
    } else {
      // Legacy full-JWT path
      decoded = jwt.verify(raw, process.env.JWT_SECRET);
    }

    if (decoded.purpose && decoded.purpose !== "tenant-registration") {
      return res.status(403).json({ message: "Invalid link purpose." });
    }

    const ownerId = decoded.id;

    const buildings = await Building.find({ owner: ownerId })
      .select("buildingName address floors")
      .lean();

    const sanitised = buildings.map((b) => ({
      ...b,
      floors: b.floors.map((f) => ({
        ...f,
        rooms: f.rooms.map((r) => ({
          ...r,
          beds: r.beds.filter((bed) => bed.status === "Available"),
        })),
      })),
    }));

    res.json({ valid: true, buildings: sanitised });
  } catch (err) {
    res.status(401).json({ message: "Link is invalid or has expired." });
  }
});

// Self-registration via onboarding link
router.post("/register-via-link", upload.fields([
  { name: "aadharFront", maxCount: 1 },
  { name: "aadharBack", maxCount: 1 },
  { name: "passportPhoto", maxCount: 1 }
]), async (req, res) => {
  try {
    const {
      linkToken,
      name, phone, email, fatherName, fatherPhone, permanentAddress, 
      joiningDate, rentAmount, advanceAmount,
      buildingId, floorId, roomId, bedId,
    } = req.body;

    // Resolve short code or legacy full JWT
    let decoded;
    try {
      if (linkToken && linkToken.length <= 12) {
        const entry = shortTokenStore.get(linkToken);
        if (!entry || entry.expiresAt < Date.now()) {
          return res.status(401).json({ message: "Registration link is invalid or expired." });
        }
        decoded = jwt.verify(entry.jwtToken, process.env.JWT_SECRET);
      } else {
        decoded = jwt.verify(linkToken, process.env.JWT_SECRET);
      }
    } catch {
      return res.status(401).json({ message: "Registration link is invalid or expired." });
    }

    const ownerId = decoded.id;

    if (!name || !phone || !permanentAddress || !joiningDate || !rentAmount) {
      return res.status(400).json({
        message: "name, phone, permanentAddress, joiningDate, rentAmount are required.",
      });
    }

    let documents = {
      aadharFront: null,
      aadharBack: null,
      passportPhoto: null
    };

    if (req.files) {
      if (req.files.aadharFront && process.env.CLOUDINARY_CLOUD_NAME) {
        try {
          documents.aadharFront = await uploadToCloudinary(
            req.files.aadharFront[0].buffer,
            "tenant_documents/aadhar"
          );
        } catch (err) {
          console.error("Upload error:", err.message);
        }
      }
      
      if (req.files.aadharBack && process.env.CLOUDINARY_CLOUD_NAME) {
        try {
          documents.aadharBack = await uploadToCloudinary(
            req.files.aadharBack[0].buffer,
            "tenant_documents/aadhar"
          );
        } catch (err) {
          console.error("Upload error:", err.message);
        }
      }
      
      if (req.files.passportPhoto && process.env.CLOUDINARY_CLOUD_NAME) {
        try {
          documents.passportPhoto = await uploadToCloudinary(
            req.files.passportPhoto[0].buffer,
            "tenant_documents/passport"
          );
        } catch (err) {
          console.error("Upload error:", err.message);
        }
      }
    }

    const advance = advanceAmount && Number(advanceAmount) > 0 ? Number(advanceAmount) : 0;

    let allocationInfo = {};

    if (buildingId && floorId && roomId && bedId) {
      const building = await Building.findOne({ _id: buildingId, owner: ownerId });
      if (!building) return res.status(404).json({ message: "Building not found." });

      const floor = building.floors.id(floorId);
      if (!floor) return res.status(404).json({ message: "Floor not found." });

      const room = floor.rooms.id(roomId);
      if (!room) return res.status(404).json({ message: "Room not found." });

      const bed = room.beds.id(bedId);
      if (!bed) return res.status(404).json({ message: "Bed not found." });

      if (bed.status === "Occupied") {
        return res.status(400).json({ message: "That bed was just taken. Please choose another." });
      }

      allocationInfo = {
        buildingName: building.buildingName,
        floorNumber: floor.floorNumber,
        roomNumber: room.roomNumber,
        bedNumber: bed.bedNumber,
      };

      const tenant = new Tenant({
        owner: ownerId, name, phone, email, fatherName, fatherPhone, 
        permanentAddress, joiningDate, rentAmount, advanceAmount: advance, documents,
        buildingId, floorId, roomId, bedId, allocationInfo,
        source: "onboarding-link",
      });
      await tenant.save();

      bed.status = "Occupied";
      bed.tenantId = tenant._id;
      await building.save();

      return res.status(201).json({
        message: "Registered successfully! Your room has been allocated.",
        tenant,
      });
    }

    const tenant = new Tenant({
      owner: ownerId, name, phone, email, fatherName, fatherPhone,
      permanentAddress, joiningDate, rentAmount, advanceAmount: advance, documents,
      source: "onboarding-link",
    });
    await tenant.save();

    res.status(201).json({
      message: "Registered successfully! Your manager will assign a room shortly.",
      tenant,
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── PROTECTED ROUTES ──────────────────────────────────────────────────────────

// Add tenant (admin)
router.post("/", auth, upload.fields([
  { name: "aadharFront", maxCount: 1 },
  { name: "aadharBack", maxCount: 1 },
  { name: "passportPhoto", maxCount: 1 }
]), async (req, res) => {
  try {
    const { 
      name, phone, email, fatherName, fatherPhone, permanentAddress, 
      joiningDate, rentAmount, advanceAmount, buildingId, floorId, roomId, bedId 
    } = req.body;

    if (!name || !phone || !permanentAddress || !joiningDate || !rentAmount) {
      return res.status(400).json({ 
        message: "Name, phone, permanentAddress, joiningDate, rentAmount are required." 
      });
    }

    let documents = {
      aadharFront: null,
      aadharBack: null,
      passportPhoto: null
    };

    if (req.files) {
      if (req.files.aadharFront) {
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          try {
            documents.aadharFront = await uploadToCloudinary(
              req.files.aadharFront[0].buffer,
              "tenant_documents/aadhar"
            );
          } catch { /* fall back to base64 */ }
        }
        if (!documents.aadharFront) {
          documents.aadharFront = `data:${req.files.aadharFront[0].mimetype};base64,${req.files.aadharFront[0].buffer.toString('base64')}`;
        }
      }
      if (req.files.aadharBack) {
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          try {
            documents.aadharBack = await uploadToCloudinary(
              req.files.aadharBack[0].buffer,
              "tenant_documents/aadhar"
            );
          } catch { /* fall back to base64 */ }
        }
        if (!documents.aadharBack) {
          documents.aadharBack = `data:${req.files.aadharBack[0].mimetype};base64,${req.files.aadharBack[0].buffer.toString('base64')}`;
        }
      }
      if (req.files.passportPhoto) {
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          try {
            documents.passportPhoto = await uploadToCloudinary(
              req.files.passportPhoto[0].buffer,
              "tenant_documents/passport"
            );
          } catch { /* fall back to base64 */ }
        }
        if (!documents.passportPhoto) {
          documents.passportPhoto = `data:${req.files.passportPhoto[0].mimetype};base64,${req.files.passportPhoto[0].buffer.toString('base64')}`;
        }
      }
    }

    const advance = advanceAmount && Number(advanceAmount) > 0 ? Number(advanceAmount) : 0;

    let allocationInfo = {};
    
    if (buildingId && floorId && roomId && bedId && 
        buildingId !== "" && floorId !== "" && roomId !== "" && bedId !== "") {
      
      const building = await Building.findOne({ _id: buildingId, owner: req.user.id });
      if (!building) return res.status(404).json({ message: "Building not found." });
      
      const floor = building.floors.id(floorId);
      if (!floor) return res.status(404).json({ message: "Floor not found." });
      
      const room = floor.rooms.id(roomId);
      if (!room) return res.status(404).json({ message: "Room not found." });
      
      const bed = room.beds.id(bedId);
      if (!bed) return res.status(404).json({ message: "Bed not found." });
      
      if (bed.status === "Occupied") {
        return res.status(400).json({ message: "Bed is already occupied." });
      }

      allocationInfo = {
        buildingName: building.buildingName,
        floorNumber: floor.floorNumber,
        roomNumber: room.roomNumber,
        bedNumber: bed.bedNumber,
      };

      const tenant = new Tenant({
        owner: req.user.id, 
        name: name.trim(), 
        phone: phone.trim(), 
        email: email ? email.trim() : null, 
        fatherName: fatherName ? fatherName.trim() : null, 
        fatherPhone: fatherPhone ? fatherPhone.trim() : null,
        permanentAddress: permanentAddress.trim(), 
        joiningDate, 
        rentAmount: Number(rentAmount),
        advanceAmount: advance,
        documents,
        buildingId, 
        floorId, 
        roomId, 
        bedId, 
        allocationInfo,
      });
      
      await tenant.save();

      bed.status = "Occupied";
      bed.tenantId = tenant._id;
      await building.save();

      return res.status(201).json({ 
        message: "Tenant added and bed allocated.", 
        tenant 
      });
    }

    const tenant = new Tenant({ 
      owner: req.user.id, 
      name: name.trim(), 
      phone: phone.trim(), 
      email: email ? email.trim() : null, 
      fatherName: fatherName ? fatherName.trim() : null, 
      fatherPhone: fatherPhone ? fatherPhone.trim() : null,
      permanentAddress: permanentAddress.trim(), 
      joiningDate, 
      rentAmount: Number(rentAmount),
      advanceAmount: advance,
      documents 
    });
    
    await tenant.save();
    res.status(201).json({ message: "Tenant added successfully.", tenant });
    
  } catch (err) {
    console.error("Error adding tenant:", err.message);
    res.status(500).json({ 
      message: "Server error.", 
      error: err.message
    });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const filter = { owner: req.user.id };
    if (req.query.source) filter.source = req.query.source;
    const tenants = await Tenant.find(filter).sort({ createdAt: -1 });
    res.json(tenants);
  } catch (err) {
    console.error("Error fetching tenants:", err);
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.id, owner: req.user.id });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });
    res.json(tenant);
  } catch (err) {
    console.error("Error fetching tenant:", err);
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

router.put("/:id", auth, upload.fields([
  { name: "aadharFront", maxCount: 1 },
  { name: "aadharBack", maxCount: 1 },
  { name: "passportPhoto", maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, phone, email, fatherName, fatherPhone, permanentAddress, joiningDate, rentAmount, advanceAmount, status } = req.body;
    
    const updateData = { 
      name, phone, email, fatherName, fatherPhone, permanentAddress, 
      joiningDate, rentAmount: rentAmount ? Number(rentAmount) : undefined,
      advanceAmount: advanceAmount !== undefined ? Number(advanceAmount) : undefined,
      status 
    };
    
    if (req.files && process.env.CLOUDINARY_CLOUD_NAME) {
      updateData.documents = {};
      if (req.files.aadharFront) {
        updateData.documents.aadharFront = await uploadToCloudinary(
          req.files.aadharFront[0].buffer,
          "tenant_documents/aadhar"
        );
      }
      if (req.files.aadharBack) {
        updateData.documents.aadharBack = await uploadToCloudinary(
          req.files.aadharBack[0].buffer,
          "tenant_documents/aadhar"
        );
      }
      if (req.files.passportPhoto) {
        updateData.documents.passportPhoto = await uploadToCloudinary(
          req.files.passportPhoto[0].buffer,
          "tenant_documents/passport"
        );
      }
    }
    
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });
    res.json({ message: "Tenant updated.", tenant });
  } catch (err) {
    console.error("Error updating tenant:", err);
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

router.delete("/:id/vacate", auth, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.id, owner: req.user.id });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    if (tenant.buildingId && tenant.floorId && tenant.roomId && tenant.bedId) {
      const building = await Building.findById(tenant.buildingId);
      if (building) {
        const floor = building.floors.id(tenant.floorId);
        const room  = floor?.rooms.id(tenant.roomId);
        const bed   = room?.beds.id(tenant.bedId);
        if (bed) {
          bed.status   = "Available";
          bed.tenantId = null;
          await building.save();
        }
      }
    }

    tenant.status = "Inactive";
    tenant.buildingId = null;
    tenant.floorId = null;
    tenant.roomId = null;
    tenant.bedId = null;
    tenant.allocationInfo = {};
    await tenant.save();

    res.json({ message: "Tenant vacated and bed freed." });
  } catch (err) {
    console.error("Error vacating tenant:", err);
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;