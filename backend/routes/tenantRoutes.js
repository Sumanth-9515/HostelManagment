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
// Trim whitespace from env vars to avoid invisible-character issues
const CLD_CLOUD = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
const CLD_KEY   = (process.env.CLOUDINARY_API_KEY    || "").trim();
const CLD_SEC   = (process.env.CLOUDINARY_API_SECRET || "").trim();

const CLOUDINARY_READY = !!(CLD_CLOUD && CLD_KEY && CLD_SEC);

if (CLOUDINARY_READY) {
  cloudinary.config({ cloud_name: CLD_CLOUD, api_key: CLD_KEY, api_secret: CLD_SEC });
  console.log("✅ Cloudinary configured — documents will be uploaded to Cloudinary");
} else {
  console.warn("⚠️  Cloudinary env vars missing/empty.");
  console.warn("    CLOUDINARY_CLOUD_NAME:", CLD_CLOUD ? "✅ set" : "❌ missing");
  console.warn("    CLOUDINARY_API_KEY   :", CLD_KEY   ? "✅ set" : "❌ missing");
  console.warn("    CLOUDINARY_API_SECRET:", CLD_SEC   ? "✅ set" : "❌ missing");
  console.warn("    → Falling back to local disk storage. Documents will be served from /uploads/.");
}

// ── Local disk storage ────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "tenant-docs");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log("📁 Created upload directory:", UPLOAD_DIR);
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
// When Cloudinary is ready  → memoryStorage (upload_stream needs a Buffer)
// When Cloudinary is absent → diskStorage  (write directly to disk)
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
// Returns { aadharFront, aadharBack, passportPhoto }
//   Cloudinary → stores full https://res.cloudinary.com/... URL  ✅
//   Disk       → stores full https://<BACKEND_URL>/uploads/...   ✅
//                (BACKEND_URL from env, e.g. https://your-api.onrender.com)
//
// THIS IS THE KEY FIX:
//   Previously the disk path was stored as a bare relative path like
//   "/uploads/tenant-docs/file.jpg" which looks like a local filesystem path
//   in the DB.  Now we always store an absolute URL — either a Cloudinary
//   https:// URL or a full backend https:// URL — so the DB always has a
//   real, clickable link regardless of which storage backend is used.
const resolveDocUrls = async (files) => {
  const docs = { aadharFront: null, aadharBack: null, passportPhoto: null };
  if (!files) return docs;

  const resolveOne = async (fileArr, folder) => {
    if (!fileArr || !fileArr[0]) return null;
    const f = fileArr[0];

    // ── Cloudinary path ──────────────────────────────────────────────────────
    if (CLOUDINARY_READY) {
      try {
        const url = await uploadToCloudinary(f.buffer, folder);
        // console.log(`  ✅ Cloudinary upload OK → ${url}`);
        return url;                // e.g. https://res.cloudinary.com/demo/image/upload/...
      } catch (err) {
        console.error(`  ❌ Cloudinary upload FAILED for "${folder}":`, err.message);
        // Do NOT silently return null — surface the error so the caller knows
        throw new Error(`Cloudinary upload failed: ${err.message}`);
      }
    }

    // ── Disk fallback path ───────────────────────────────────────────────────
    // f.filename is set by multer diskStorage
    // Store a FULL URL (not a bare relative path) so the DB holds a real link.
    const backendBase = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, "");
    const fullUrl = `${backendBase}/uploads/tenant-docs/${f.filename}`;
    console.log(`  💾 Disk upload OK → ${fullUrl}`);
    return fullUrl;
  };

  // console.log("📎 Processing document uploads:", Object.keys(files));
  docs.aadharFront   = await resolveOne(files.aadharFront,   "tenant_documents/aadhar");
  docs.aadharBack    = await resolveOne(files.aadharBack,    "tenant_documents/aadhar");
  docs.passportPhoto = await resolveOne(files.passportPhoto, "tenant_documents/passport");

  const saved = Object.values(docs).filter(Boolean).length;
  console.log(`📄 Documents resolved: ${saved}/3${saved < 3 ? " (some missing — not uploaded by client)" : " ✅"}`);
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

// Generate a SHORT onboarding link (8-char code instead of full JWT in URL)
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

// Validate a short code (or legacy full JWT — backwards compatible)
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

    if (decoded.purpose && decoded.purpose !== "tenant-registration") {
      return res.status(403).json({ message: "Invalid link purpose." });
    }

    const ownerId  = decoded.id;
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
router.post(
  "/register-via-link",
  upload.fields([
    { name: "aadharFront",   maxCount: 1 },
    { name: "aadharBack",    maxCount: 1 },
    { name: "passportPhoto", maxCount: 1 },
  ]),
  async (req, res) => {
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

      const documents = await resolveDocUrls(req.files);
      const advance   = advanceAmount && Number(advanceAmount) > 0 ? Number(advanceAmount) : 0;

      // ── With room allocation ───────────────────────────────────────────────
      if (buildingId && floorId && roomId && bedId &&
          buildingId !== "" && floorId !== "" && roomId !== "" && bedId !== "") {

        const building = await Building.findOne({ _id: buildingId, owner: ownerId });
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

        const allocationInfo = {
          buildingName: building.buildingName,
          floorNumber:  floor.floorNumber,
          roomNumber:   room.roomNumber,
          bedNumber:    bed.bedNumber,
        };

        const tenant = new Tenant({
          owner: ownerId,
          name: name.trim(),
          phone: phone.trim(),
          email:       email       ? email.trim()       : null,
          fatherName:  fatherName  ? fatherName.trim()  : null,
          fatherPhone: fatherPhone ? fatherPhone.trim() : null,
          permanentAddress: permanentAddress.trim(),
          joiningDate,
          rentAmount: Number(rentAmount),
          advanceAmount: advance,
          documents,
          buildingId, floorId, roomId, bedId, allocationInfo,
          source: "onboarding-link",
        });
        await tenant.save();

        bed.status   = "Occupied";
        bed.tenantId = tenant._id;
        await building.save();

        return res.status(201).json({
          message: "Registered successfully! Your room has been allocated.",
          tenant,
        });
      }

      // ── Without room allocation ──────────────────────────────────────────
      const tenant = new Tenant({
        owner: ownerId,
        name: name.trim(),
        phone: phone.trim(),
        email:       email       ? email.trim()       : null,
        fatherName:  fatherName  ? fatherName.trim()  : null,
        fatherPhone: fatherPhone ? fatherPhone.trim() : null,
        permanentAddress: permanentAddress.trim(),
        joiningDate,
        rentAmount: Number(rentAmount),
        advanceAmount: advance,
        documents,
        source: "onboarding-link",
      });
      await tenant.save();

      res.status(201).json({
        message: "Registered successfully! Your manager will assign a room shortly.",
        tenant,
      });
    } catch (err) {
      console.error("❌ register-via-link error:", err);
      res.status(500).json({ message: "Server error.", error: err.message });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// Add tenant — admin (AddCandidate form)
router.post(
  "/",
  auth,
  upload.fields([
    { name: "aadharFront",   maxCount: 1 },
    { name: "aadharBack",    maxCount: 1 },
    { name: "passportPhoto", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        name, phone, email, fatherName, fatherPhone, permanentAddress,
        joiningDate, rentAmount, advanceAmount,
        buildingId, floorId, roomId, bedId,
      } = req.body;

      if (!name || !phone || !permanentAddress || !joiningDate || !rentAmount)
        return res.status(400).json({ message: "Name, phone, permanentAddress, joiningDate, rentAmount are required." });

      const documents = await resolveDocUrls(req.files);
      const advance   = advanceAmount && Number(advanceAmount) > 0 ? Number(advanceAmount) : 0;

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

        if (bed.status === "Occupied")
          return res.status(400).json({ message: "Bed is already occupied." });

        const allocationInfo = {
          buildingName: building.buildingName,
          floorNumber:  floor.floorNumber,
          roomNumber:   room.roomNumber,
          bedNumber:    bed.bedNumber,
        };

        const tenant = new Tenant({
          owner: req.user.id,
          name: name.trim(), phone: phone.trim(),
          email:       email       ? email.trim()       : null,
          fatherName:  fatherName  ? fatherName.trim()  : null,
          fatherPhone: fatherPhone ? fatherPhone.trim() : null,
          permanentAddress: permanentAddress.trim(),
          joiningDate, rentAmount: Number(rentAmount), advanceAmount: advance,
          documents, buildingId, floorId, roomId, bedId, allocationInfo,
        });
        await tenant.save();

        bed.status   = "Occupied";
        bed.tenantId = tenant._id;
        await building.save();

        return res.status(201).json({ message: "Tenant added and bed allocated.", tenant });
      }

      const tenant = new Tenant({
        owner: req.user.id,
        name: name.trim(), phone: phone.trim(),
        email:       email       ? email.trim()       : null,
        fatherName:  fatherName  ? fatherName.trim()  : null,
        fatherPhone: fatherPhone ? fatherPhone.trim() : null,
        permanentAddress: permanentAddress.trim(),
        joiningDate, rentAmount: Number(rentAmount), advanceAmount: advance,
        documents,
      });
      await tenant.save();
      res.status(201).json({ message: "Tenant added successfully.", tenant });

    } catch (err) {
      console.error("❌ POST /tenants error:", err.message);
      res.status(500).json({ message: "Server error.", error: err.message });
    }
  }
);

// Get all tenants
router.get("/", auth, async (req, res) => {
  try {
    const filter = { owner: req.user.id };
    if (req.query.source) filter.source = req.query.source;
    const tenants = await Tenant.find(filter).sort({ createdAt: -1 });
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// Get single tenant
router.get("/:id", auth, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.id, owner: req.user.id });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });
    res.json(tenant);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// Update tenant
router.put(
  "/:id",
  auth,
  upload.fields([
    { name: "aadharFront",   maxCount: 1 },
    { name: "aadharBack",    maxCount: 1 },
    { name: "passportPhoto", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        name, phone, email, fatherName, fatherPhone, permanentAddress,
        joiningDate, rentAmount, advanceAmount, status,
      } = req.body;

      const updateData = {
        name, phone, email, fatherName, fatherPhone, permanentAddress, joiningDate,
        rentAmount:    rentAmount    ? Number(rentAmount)    : undefined,
        advanceAmount: advanceAmount !== undefined ? Number(advanceAmount) : undefined,
        status,
      };

      if (req.files && Object.keys(req.files).length > 0) {
        const newDocs = await resolveDocUrls(req.files);
        if (newDocs.aadharFront)   updateData["documents.aadharFront"]   = newDocs.aadharFront;
        if (newDocs.aadharBack)    updateData["documents.aadharBack"]    = newDocs.aadharBack;
        if (newDocs.passportPhoto) updateData["documents.passportPhoto"] = newDocs.passportPhoto;
      }

      const tenant = await Tenant.findOneAndUpdate(
        { _id: req.params.id, owner: req.user.id },
        updateData,
        { new: true, runValidators: true }
      );

      if (!tenant) return res.status(404).json({ message: "Tenant not found." });
      res.json({ message: "Tenant updated.", tenant });
    } catch (err) {
      console.error("❌ PUT /tenants/:id error:", err.message);
      res.status(500).json({ message: "Server error.", error: err.message });
    }
  }
);

// Vacate tenant — free the bed and mark tenant Inactive
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

    tenant.status      = "Inactive";
    tenant.buildingId  = null;
    tenant.floorId     = null;
    tenant.roomId      = null;
    tenant.bedId       = null;
    tenant.allocationInfo = {};
    await tenant.save();

    res.json({ message: "Tenant vacated and bed freed." });
  } catch (err) {
    console.error("Error vacating tenant:", err);
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// Reallocate bed — free old bed, assign new bed
router.put("/:id/reallocate", auth, async (req, res) => {
  try {
    const { buildingId, floorId, roomId, bedId, allocationInfo } = req.body;
    if (!buildingId || !floorId || !roomId || !bedId) {
      return res.status(400).json({ message: "buildingId, floorId, roomId, bedId are required." });
    }

    const tenant = await Tenant.findOne({ _id: req.params.id, owner: req.user.id });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    // 1. Free previous bed
    if (tenant.buildingId && tenant.floorId && tenant.roomId && tenant.bedId) {
      const oldBuilding = await Building.findById(tenant.buildingId);
      if (oldBuilding) {
        const oldFloor = oldBuilding.floors.id(tenant.floorId);
        const oldRoom  = oldFloor?.rooms.id(tenant.roomId);
        const oldBed   = oldRoom?.beds.id(tenant.bedId);
        if (oldBed) {
          oldBed.status   = "Available";
          oldBed.tenantId = null;
          await oldBuilding.save();
        }
      }
    }

    // 2. Occupy new bed
    const newBuilding = await Building.findOne({ _id: buildingId, owner: req.user.id });
    if (!newBuilding) return res.status(404).json({ message: "New building not found." });
    const newFloor = newBuilding.floors.id(floorId);
    if (!newFloor) return res.status(404).json({ message: "New floor not found." });
    const newRoom = newFloor.rooms.id(roomId);
    if (!newRoom) return res.status(404).json({ message: "New room not found." });
    const newBed = newRoom.beds.id(bedId);
    if (!newBed) return res.status(404).json({ message: "New bed not found." });
    if (newBed.status === "Occupied") return res.status(400).json({ message: "Selected bed is already occupied." });

    newBed.status   = "Occupied";
    newBed.tenantId = tenant._id;
    await newBuilding.save();

    // 3. Update tenant allocation
    tenant.buildingId     = buildingId;
    tenant.floorId        = floorId;
    tenant.roomId         = roomId;
    tenant.bedId          = bedId;
    tenant.allocationInfo = allocationInfo || {
      buildingName: newBuilding.buildingName,
      floorNumber:  newFloor.floorNumber,
      roomNumber:   newRoom.roomNumber,
      bedNumber:    newBed.bedNumber,
    };
    await tenant.save();

    res.json({ message: "Tenant reallocated successfully.", tenant });
  } catch (err) {
    console.error("Error reallocating tenant:", err);
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;