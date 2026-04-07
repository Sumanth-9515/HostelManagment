import "dotenv/config";
import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Tenant from "../models/Tenant.js";
import Building from "../models/Building.js";
import jwt from "jsonwebtoken";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

// ── __dirname for ES modules ──────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── In-memory short-token store ───────────────────────────────────────────────
const shortTokenStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of shortTokenStore.entries()) {
    if (v.expiresAt < now) shortTokenStore.delete(k);
  }
}, 60 * 60 * 1000);

// ── Cloudinary setup ──────────────────────────────────────────────────────────
const CLD_CLOUD = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
const CLD_KEY   = (process.env.CLOUDINARY_API_KEY    || "").trim();
const CLD_SEC   = (process.env.CLOUDINARY_API_SECRET || "").trim();

const CLOUDINARY_READY = !!(CLD_CLOUD && CLD_KEY && CLD_SEC);

if (CLOUDINARY_READY) {
  cloudinary.config({ cloud_name: CLD_CLOUD, api_key: CLD_KEY, api_secret: CLD_SEC });
  console.log("✅ Cloudinary configured — documents will be uploaded to Cloudinary");
} else {
  console.warn("⚠️  Cloudinary env vars missing/empty. Falling back to local disk storage.");
}

// ── Local disk storage ────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "tenant-docs");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext    = path.extname(file.originalname).toLowerCase() || ".jpg";
    const unique = `${Date.now()}-${crypto.randomBytes(2).toString("hex")}`;
    cb(null, `${file.fieldname}-${unique}${ext}`);
  },
});

// ── Multer instance ───────────────────────────────────────────────────────────
const upload = multer({
  storage: CLOUDINARY_READY ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|jpg|png|webp)|application\/pdf$/.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error("Only JPG, PNG, WEBP or PDF files are allowed"));
  },
});

// ── Cloudinary upload helper ──────────────────────────────────────────────────
const uploadToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: "auto" }, (err, result) =>
        err ? reject(err) : resolve(result.secure_url)
      )
      .end(buffer);
  });

// ── Document URL resolver ─────────────────────────────────────────────────────
const resolveDocUrls = async (files) => {
  const docs = { aadharFront: null, aadharBack: null, passportPhoto: null };
  if (!files) return docs;

  const resolveOne = async (fileArr, folder) => {
    if (!fileArr || !fileArr[0]) return null;
    const f = fileArr[0];

    if (CLOUDINARY_READY) {
      try {
        const url = await uploadToCloudinary(f.buffer, folder);
        return url;
      } catch (err) {
        console.error(`❌ Cloudinary upload FAILED:`, err.message);
        throw new Error(`Cloudinary upload failed: ${err.message}`);
      }
    }
    const backendBase = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, "");
    return `${backendBase}/uploads/tenant-docs/${f.filename}`;
  };

  docs.aadharFront   = await resolveOne(files.aadharFront,   "tenant_documents/aadhar");
  docs.aadharBack    = await resolveOne(files.aadharBack,    "tenant_documents/aadhar");
  docs.passportPhoto = await resolveOne(files.passportPhoto, "tenant_documents/passport");
  return docs;
};

// ── Auth middleware ───────────────────────────────────────────────────────────
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

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// Generate Onboarding Link
router.get("/generate-link", auth, (req, res) => {
  const jwtToken = jwt.sign(
    { id: req.user.id, purpose: "tenant-registration" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  const shortCode = crypto.randomBytes(5).toString("base64url").slice(0, 8);
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  shortTokenStore.set(shortCode, { jwtToken, expiresAt });
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const link = `${frontendUrl}/tenant-register/${shortCode}`;
  res.json({ link, expiresIn: "7 days" });
});

// Validate Link (Restored JWT Purpose Check)
router.get("/validate-link/:token", async (req, res) => {
  try {
    let decoded;
    const raw = req.params.token;

    if (raw.length <= 12) {
      const entry = shortTokenStore.get(raw);
      if (!entry || entry.expiresAt < Date.now()) {
        return res.status(401).json({ message: "Link is invalid or has expired." });
      }
      decoded = jwt.verify(entry.jwtToken, process.env.JWT_SECRET);
    } else {
      decoded = jwt.verify(raw, process.env.JWT_SECRET);
    }

    // ✅ RESTORED: JWT Purpose Check
    if (decoded.purpose && decoded.purpose !== "tenant-registration") {
      return res.status(403).json({ message: "Invalid link purpose." });
    }

    const ownerId  = decoded.id;
    const buildings = await Building.find({ owner: ownerId }).select("buildingName address floors").lean();

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

// Self-registration (Restored Input Validation & Bed Occupancy Check)
router.post("/register-via-link", upload.fields([{ name: "aadharFront", maxCount: 1 }, { name: "aadharBack", maxCount: 1 }, { name: "passportPhoto", maxCount: 1 }]), async (req, res) => {
    try {
      const {
        linkToken, name, phone, email, fatherName, fatherPhone, permanentAddress,
        joiningDate, rentAmount, advanceAmount, buildingId, floorId, roomId, bedId,
      } = req.body;

      let decoded;
      try {
        if (linkToken && linkToken.length <= 12) {
          const entry = shortTokenStore.get(linkToken);
          decoded = jwt.verify(entry.jwtToken, process.env.JWT_SECRET);
        } else {
          decoded = jwt.verify(linkToken, process.env.JWT_SECRET);
        }
      } catch { return res.status(401).json({ message: "Invalid link." }); }

      const ownerId = decoded.id;

      // ✅ RESTORED: Input Validation
      if (!name || !phone || !permanentAddress || !joiningDate || !rentAmount) {
        return res.status(400).json({ message: "name, phone, permanentAddress, joiningDate, rentAmount are required." });
      }

      const documents = await resolveDocUrls(req.files);
      const advance = advanceAmount && Number(advanceAmount) > 0 ? Number(advanceAmount) : 0;

      if (buildingId && floorId && roomId && bedId && buildingId !== "") {
        const building = await Building.findOne({ _id: buildingId, owner: ownerId });
        if (!building) return res.status(404).json({ message: "Building not found." });
        const floor = building.floors.id(floorId);
     const room = floor?.rooms.id(roomId);
        const bed = room?.beds.id(bedId);

        // ✅ RESTORED: Bed Occupancy Check
        if (!bed || bed.status === "Occupied") return res.status(400).json({ message: "Bed is already occupied." });

        const allocationInfo = {
          buildingName: building.buildingName, floorNumber: floor.floorNumber,
          roomNumber: room.roomNumber, bedNumber: bed.bedNumber,
        };

        const tenant = new Tenant({
          owner: ownerId, name: name.trim(), phone: phone.trim(), email, fatherName, fatherPhone,
          permanentAddress: permanentAddress.trim(), joiningDate, rentAmount: Number(rentAmount),
          advanceAmount: advance, documents, buildingId, floorId, roomId, bedId, allocationInfo,
          source: "onboarding-link", isVerified: false
        });
        await tenant.save();

        bed.status = "Occupied"; bed.tenantId = tenant._id;
        await building.save();

        const loc = `${building.buildingName} ➔ Floor ${floor.floorNumber} ➔ Room ${room.roomNumber} ➔ Bed ${bed.bedNumber}`;
        await logActivity(ownerId, "ONBOARD", "Tenant", `New registration: ${name} at ${loc}`);

        return res.status(201).json({ message: "Registered successfully!", tenant });
      }

      const tenant = new Tenant({
        owner: ownerId, name: name.trim(), phone: phone.trim(), email, fatherName, fatherPhone,
        permanentAddress: permanentAddress.trim(), joiningDate, rentAmount: Number(rentAmount),
        advanceAmount: advance, documents, source: "onboarding-link", isVerified: false
      });
      await tenant.save();
      await logActivity(ownerId, "ONBOARD", "Tenant", `New registration: ${name} (Waiting for room)`);

      res.status(201).json({ message: "Registered successfully!", tenant });
    } catch (err) { res.status(500).json({ message: "Server error.", error: err.message }); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTES
// ══════════════════════════════════════════════════════════════════════════════

router.get("/notifications", auth, async (req, res) => {
  try {
    const tenants = await Tenant.find({ owner: req.user.id, source: "onboarding-link" })
      .select("name phone email joiningDate rentAmount allocationInfo isVerified createdAt documents")
      .sort({ createdAt: -1 }).limit(30);
    res.json(tenants);
  } catch (err) { res.status(500).json({ message: "Server error." }); }
});

router.patch("/mark-verified", auth, async (req, res) => {
  try {
    await Tenant.updateMany({ owner: req.user.id, source: "onboarding-link", isVerified: false }, { $set: { isVerified: true } });
    res.json({ message: "Marked verified." });
  } catch (err) { res.status(500).json({ message: "Server error." }); }
});

// Admin Add Tenant (Restored Validation & Bed Check)
router.post("/", auth, upload.fields([{ name: "aadharFront" }, { name: "aadharBack" }, { name: "passportPhoto" }]), async (req, res) => {
    try {
      const { name, phone, email, fatherName, fatherPhone, permanentAddress, joiningDate, rentAmount, advanceAmount, buildingId, floorId, roomId, bedId } = req.body;
      
      // ✅ RESTORED: Input Validation
      if (!name || !phone || !permanentAddress || !joiningDate || !rentAmount) {
        return res.status(400).json({ message: "Name, phone, permanentAddress, joiningDate, rentAmount are required." });
      }

      const documents = await resolveDocUrls(req.files);
      const advance = advanceAmount ? Number(advanceAmount) : 0;

      if (buildingId && floorId && roomId && bedId && buildingId !== "") {
        const building = await Building.findOne({ _id: buildingId, owner: req.user.id });
        if (!building) return res.status(404).json({ message: "Building not found." });
        const floor = building.floors.id(floorId);
      const room = floor?.rooms.id(roomId);
        const bed = room?.beds.id(bedId);

        // ✅ RESTORED: Bed Occupancy Check
        if (!bed || bed.status === "Occupied") return res.status(400).json({ message: "Bed is already occupied." });

        const allocationInfo = {
          buildingName: building.buildingName, floorNumber: floor.floorNumber,
          roomNumber: room.roomNumber, bedNumber: bed.bedNumber,
        };

        const tenant = new Tenant({
          owner: req.user.id, name: name.trim(), phone: phone.trim(), email, fatherName, fatherPhone, permanentAddress, joiningDate, rentAmount: Number(rentAmount), advanceAmount: advance, documents, buildingId, floorId, roomId, bedId, allocationInfo
        });
        await tenant.save();

        bed.status = "Occupied"; bed.tenantId = tenant._id;
        await building.save();

        const loc = `${building.buildingName} ➔ Floor ${floor.floorNumber} ➔ Room ${room.roomNumber} ➔ Bed ${bed.bedNumber}`;
        await logActivity(req.user.id, "CREATE", "Tenant", `Added Tenant: ${name} at ${loc}`);
        return res.status(201).json({ message: "Tenant added.", tenant });
      }

      const tenant = new Tenant({ owner: req.user.id, name, phone, email, fatherName, fatherPhone, permanentAddress, joiningDate, rentAmount: Number(rentAmount), advanceAmount: advance, documents });
      await tenant.save();
      await logActivity(req.user.id, "CREATE", "Tenant", `Added Tenant: ${name} (No Room Assigned)`);
      res.status(201).json({ message: "Tenant added successfully.", tenant });
    } catch (err) { res.status(500).json({ message: "Server error.", error: err.message }); }
  }
);

router.get("/", auth, async (req, res) => {
  try {
    const filter = { owner: req.user.id };
    if (req.query.source) filter.source = req.query.source;
    const tenants = await Tenant.find(filter).sort({ createdAt: -1 });
    res.json(tenants);
  } catch (err) { res.status(500).json({ message: "Server error." }); }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.id, owner: req.user.id });
    res.json(tenant);
  } catch (err) { res.status(500).json({ message: "Server error." }); }
});

router.put("/:id", auth, upload.fields([{ name: "aadharFront" }, { name: "aadharBack" }, { name: "passportPhoto" }]), async (req, res) => {
  try {
    const existingTenant = await Tenant.findOne({ _id: req.params.id, owner: req.user.id });
    if (!existingTenant) return res.status(404).json({ message: "Tenant not found." });

    const updateData = { ...req.body };
    if (req.files && Object.keys(req.files).length > 0) {
      const newDocs = await resolveDocUrls(req.files);
      if (newDocs.aadharFront)   updateData["documents.aadharFront"]   = newDocs.aadharFront;
      if (newDocs.aadharBack)    updateData["documents.aadharBack"]    = newDocs.aadharBack;
      if (newDocs.passportPhoto) updateData["documents.passportPhoto"] = newDocs.passportPhoto;
    }

    const updatedTenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      updateData, { new: true, runValidators: true }
    );

    const info = existingTenant.allocationInfo;
    const loc = info?.buildingName ? `(${info.buildingName} ➔ Room ${info.roomNumber})` : "(Unallocated)";
    await logActivity(req.user.id, "UPDATE", "Tenant", `Updated details for ${updatedTenant.name} ${loc}`);

    res.json({ message: "Tenant updated.", tenant: updatedTenant });
  } catch (err) { res.status(500).json({ message: "Server error.", error: err.message }); }
});

router.delete("/:id/vacate", auth, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.id, owner: req.user.id });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const info = tenant.allocationInfo;
    const locationString = info?.buildingName ? `${info.buildingName} ➔ Floor ${info.floorNumber} ➔ Room ${info.roomNumber} ➔ Bed ${info.bedNumber}` : "Unallocated Room";

    if (tenant.buildingId && tenant.floorId && tenant.roomId && tenant.bedId) {
      const building = await Building.findById(tenant.buildingId);
      if (building) {
        const floor = building.floors.id(tenant.floorId);
        const room  = floor?.rooms.id(tenant.roomId);
        const bed   = room?.beds.id(tenant.bedId);
        if (bed) { bed.status = "Available"; bed.tenantId = null; await building.save(); }
      }
    }

    tenant.status = "Inactive"; tenant.buildingId = null; tenant.floorId = null; tenant.roomId = null; tenant.bedId = null; tenant.allocationInfo = {};
    await tenant.save();

    await logActivity(req.user.id, "VACATE", "Tenant", `Vacated Tenant: ${tenant.name} from ${locationString}`);
    res.json({ message: "Tenant vacated." });
  } catch (err) { res.status(500).json({ message: "Server error." }); }
});

router.put("/:id/reallocate", auth, async (req, res) => {
  try {
    const { buildingId, floorId, roomId, bedId } = req.body;
    
    // ✅ RESTORED: Required ID Validation
    if (!buildingId || !floorId || !roomId || !bedId) {
      return res.status(400).json({ message: "buildingId, floorId, roomId, bedId are required." });
    }

    const tenant = await Tenant.findOne({ _id: req.params.id, owner: req.user.id });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const oldInfo = tenant.allocationInfo;
    const oldLoc = oldInfo?.buildingName ? `${oldInfo.buildingName} (Rm ${oldInfo.roomNumber})` : "Unallocated";

    if (tenant.bedId) {
      const oldB = await Building.findById(tenant.buildingId);
      const oldBed = oldB?.floors.id(tenant.floorId)?.rooms.id(tenant.roomId)?.beds.id(tenant.bedId);
      if (oldBed) { oldBed.status = "Available"; oldBed.tenantId = null; await oldB.save(); }
    }

    const newB = await Building.findOne({ _id: buildingId, owner: req.user.id });
    if (!newB) return res.status(404).json({ message: "New building not found." });
    const f = newB.floors.id(floorId);
 const r = f?.rooms.id(roomId); 
    const b = r?.beds.id(bedId);

    // ✅ RESTORED: Bed Occupancy Check for Reallocation
    if (!b || b.status === "Occupied") return res.status(400).json({ message: "Selected bed is already occupied." });

    b.status = "Occupied"; b.tenantId = tenant._id;
    await newB.save();

    tenant.buildingId = buildingId; tenant.floorId = floorId; tenant.roomId = roomId; tenant.bedId = bedId;
    tenant.allocationInfo = { buildingName: newB.buildingName, floorNumber: f.floorNumber, roomNumber: r.roomNumber, bedNumber: b.bedNumber };
    await tenant.save();

    const newLoc = `${newB.buildingName} ➔ Floor ${f.floorNumber} ➔ Room ${r.roomNumber} ➔ Bed ${b.bedNumber}`;
    await logActivity(req.user.id, "REALLOCATE", "Tenant", `Moved ${tenant.name} from ${oldLoc} to ${newLoc}`);

    res.json({ message: "Tenant reallocated.", tenant });
  } catch (err) { res.status(500).json({ message: "Server error.", error: err.message }); }
});

export default router;