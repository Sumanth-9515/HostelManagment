import express from "express";
import Tenant from "../models/Tenant.js";
import Building from "../models/Building.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// ── Auth middleware (protected routes) ───────────────────────────────────────
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

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES — no auth header needed (tenant uses the link token instead)
// ────────────────────────────────────────────────────────────────────────────

// ── GENERATE REGISTRATION LINK (owner calls this to get a shareable URL) ────
// GET /api/tenants/generate-link
// Returns: { link: "http://yourfrontend/tenant-register/<ownerJWT>" }
// The owner's existing JWT is reused as the link token (it already encodes
// their userId and expires in 1 day — perfect for a registration invite).
router.get("/generate-link", auth, (req, res) => {
  // Re-sign a dedicated link token that only encodes owner id
  // (shorter expiry = safer for sharing)
  const linkToken = jwt.sign(
    { id: req.user.id, purpose: "tenant-registration" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const link = `${frontendUrl}/tenant-register/${linkToken}`;

  res.json({ link, expiresIn: "7 days" });
});

// ── VALIDATE LINK (called on page load to verify token and fetch buildings) ─
// GET /api/tenants/validate-link/:token
// Returns: { valid: true, buildings: [...] }
router.get("/validate-link/:token", async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);

    // Ensure this token was made for tenant registration (not a login token)
    // We accept both dedicated link tokens and regular user tokens for backward compat.
    if (decoded.purpose && decoded.purpose !== "tenant-registration") {
      return res.status(403).json({ message: "Invalid link purpose." });
    }

    const ownerId = decoded.id;

    // Return the owner's buildings so the tenant can pick their room
    const buildings = await Building.find({ owner: ownerId })
      .select("buildingName address floors")
      .lean();

    // Strip occupied beds so the tenant only sees available ones
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

// ── REGISTER TENANT VIA LINK (the form submit) ───────────────────────────────
// POST /api/tenants/register-via-link
// Body: { linkToken, name, phone, email?, permanentAddress, joiningDate,
//         rentAmount, buildingId?, floorId?, roomId?, bedId? }
router.post("/register-via-link", async (req, res) => {
  try {
    const {
      linkToken,
      name, phone, email, permanentAddress, joiningDate, rentAmount,
      buildingId, floorId, roomId, bedId,
    } = req.body;

    // ── Verify link token ──────────────────────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(linkToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Registration link is invalid or expired." });
    }

    const ownerId = decoded.id;

    // ── Validate required fields ───────────────────────────────────────────
    if (!name || !phone || !permanentAddress || !joiningDate || !rentAmount) {
      return res.status(400).json({
        message: "name, phone, permanentAddress, joiningDate, rentAmount are required.",
      });
    }

    // ── Optional bed allocation ────────────────────────────────────────────
    let allocationInfo = {};

    if (buildingId && floorId && roomId && bedId) {
      // Verify the building belongs to this owner
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
        floorNumber:  floor.floorNumber,
        roomNumber:   room.roomNumber,
        bedNumber:    bed.bedNumber,
      };

      // Create tenant
      const tenant = new Tenant({
        owner: ownerId, name, phone, email, permanentAddress, joiningDate, rentAmount,
        buildingId, floorId, roomId, bedId, allocationInfo,
      });
      await tenant.save();

      // Mark bed occupied
      bed.status   = "Occupied";
      bed.tenantId = tenant._id;
      await building.save();

      return res.status(201).json({
        message: "Registered successfully! Your room has been allocated.",
        tenant,
      });
    }

    // ── No allocation — save tenant without bed ────────────────────────────
    const tenant = new Tenant({
      owner: ownerId, name, phone, email, permanentAddress, joiningDate, rentAmount,
    });
    await tenant.save();

    res.status(201).json({
      message: "Registered successfully! Your manager will assign a room shortly.",
      tenant,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// PROTECTED ROUTES (owner/admin only — unchanged from original)
// ────────────────────────────────────────────────────────────────────────────

// 1. ADD TENANT (manual, by owner)
router.post("/", auth, async (req, res) => {
  try {
    const { name, phone, email, permanentAddress, joiningDate, rentAmount, buildingId, floorId, roomId, bedId } = req.body;

    if (!name || !phone || !permanentAddress || !joiningDate || !rentAmount) {
      return res.status(400).json({ message: "Name, phone, permanentAddress, joiningDate, rentAmount are required." });
    }

    let allocationInfo = {};
    if (buildingId && floorId && roomId && bedId) {
      const building = await Building.findOne({ _id: buildingId, owner: req.user.id });
      if (!building) return res.status(404).json({ message: "Building not found." });
      const floor = building.floors.id(floorId);
      if (!floor) return res.status(404).json({ message: "Floor not found." });
      const room = floor.rooms.id(roomId);
      if (!room) return res.status(404).json({ message: "Room not found." });
      const bed = room.beds.id(bedId);
      if (!bed) return res.status(404).json({ message: "Bed not found." });
      if (bed.status === "Occupied") return res.status(400).json({ message: "Bed is already occupied." });

      allocationInfo = {
        buildingName: building.buildingName,
        floorNumber: floor.floorNumber,
        roomNumber: room.roomNumber,
        bedNumber: bed.bedNumber,
      };

      const tenant = new Tenant({
        owner: req.user.id, name, phone, email, permanentAddress, joiningDate, rentAmount,
        buildingId, floorId, roomId, bedId, allocationInfo,
      });
      await tenant.save();

      bed.status = "Occupied";
      bed.tenantId = tenant._id;
      await building.save();

      return res.status(201).json({ message: "Tenant added and bed allocated.", tenant });
    }

    const tenant = new Tenant({ owner: req.user.id, name, phone, email, permanentAddress, joiningDate, rentAmount });
    await tenant.save();
    res.status(201).json({ message: "Tenant added (no allocation).", tenant });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 2. GET ALL TENANTS
router.get("/", auth, async (req, res) => {
  try {
    const tenants = await Tenant.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 3. GET SINGLE TENANT
router.get("/:id", auth, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.id, owner: req.user.id });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });
    res.json(tenant);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 4. UPDATE TENANT
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, phone, email, permanentAddress, joiningDate, rentAmount, status } = req.body;
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      { name, phone, email, permanentAddress, joiningDate, rentAmount, status },
      { new: true }
    );
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });
    res.json({ message: "Tenant updated.", tenant });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 5. VACATE TENANT
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

    tenant.status     = "Inactive";
    tenant.buildingId = null;
    tenant.floorId    = null;
    tenant.roomId     = null;
    tenant.bedId      = null;
    tenant.allocationInfo = {};
    await tenant.save();

    res.json({ message: "Tenant vacated and bed freed." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;