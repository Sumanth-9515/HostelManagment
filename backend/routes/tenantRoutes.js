import express from "express";
import Tenant from "../models/Tenant.js";
import Building from "../models/Building.js";
import jwt from "jsonwebtoken";

const router = express.Router();

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

// 1. ADD TENANT
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
        const room = floor?.rooms.id(tenant.roomId);
        const bed = room?.beds.id(tenant.bedId);
        if (bed) {
          bed.status = "Available";
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
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;
