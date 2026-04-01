import express from "express";
import Building from "../models/Building.js";
import Tenant from "../models/Tenant.js";
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

const makeBeds = (shareType) =>
  Array.from({ length: shareType }, (_, i) => ({ bedNumber: i + 1 }));

// 1. CREATE BUILDING
router.post("/", auth, async (req, res) => {
  try {
    const { buildingName, address } = req.body;
    if (!buildingName) return res.status(400).json({ message: "Building name is required." });
    const building = new Building({ owner: req.user.id, buildingName, address, floors: [] });
    await building.save();
    res.status(201).json({ message: "Building created.", building });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 2. GET ALL BUILDINGS
router.get("/", auth, async (req, res) => {
  try {
    const buildings = await Building.find({ owner: req.user.id });
    res.json(buildings);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 3. OVERVIEW STATS — must come before /:buildingId
router.get("/stats/overview", auth, async (req, res) => {
  try {
    const buildings = await Building.find({ owner: req.user.id });
    const tenants = await Tenant.find({ owner: req.user.id, status: "Active", buildingId: { $ne: null } });

    const stats = buildings.map((b) => {
      let totalFloors = b.floors.length;
      let totalRooms = 0, totalBeds = 0, occupiedBeds = 0;

      for (const floor of b.floors) {
        totalRooms += floor.rooms.length;
        for (const room of floor.rooms) {
          totalBeds += room.beds.length;
          occupiedBeds += room.beds.filter((bed) => bed.status === "Occupied").length;
        }
      }

      const buildingTenants = tenants.filter((t) => t.buildingId?.toString() === b._id.toString());
      const totalRevenue = buildingTenants.reduce((sum, t) => sum + (t.rentAmount || 0), 0);

      let roomsFilled = 0, roomsAvailable = 0;
      for (const floor of b.floors) {
        for (const room of floor.rooms) {
          const allOccupied = room.beds.every((bed) => bed.status === "Occupied");
          if (allOccupied) roomsFilled++;
          else roomsAvailable++;
        }
      }

      return {
        buildingId: b._id,
        buildingName: b.buildingName,
        address: b.address,
        totalFloors,
        totalRooms,
        totalBeds,
        occupiedBeds,
        availableBeds: totalBeds - occupiedBeds,
        roomsFilled,
        roomsAvailable,
        totalTenants: buildingTenants.length,
        totalRevenue,
      };
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 4. SEARCH ROOM — must come before /:buildingId
router.get("/search/room", auth, async (req, res) => {
  try {
    const { roomNumber } = req.query;
    if (!roomNumber) return res.status(400).json({ message: "roomNumber query param required." });

    const buildings = await Building.find({ owner: req.user.id });
    const results = [];

    for (const building of buildings) {
      for (const floor of building.floors) {
        for (const room of floor.rooms) {
          if (room.roomNumber === roomNumber) {
            const bedsWithTenants = await Promise.all(
              room.beds.map(async (bed) => {
                let tenantInfo = null;
                if (bed.tenantId) {
                  tenantInfo = await Tenant.findById(bed.tenantId).select(
                    "name phone email joiningDate rentAmount permanentAddress"
                  );
                }
                return { ...bed.toObject(), tenant: tenantInfo };
              })
            );
            results.push({
              buildingId: building._id,
              buildingName: building.buildingName,
              floorId: floor._id,
              floorNumber: floor.floorNumber,
              floorName: floor.floorName,
              roomId: room._id,
              roomNumber: room.roomNumber,
              shareType: room.shareType,
              beds: bedsWithTenants,
            });
          }
        }
      }
    }

    if (!results.length) return res.status(404).json({ message: `No room found with number "${roomNumber}".` });
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 5. GET SINGLE BUILDING
router.get("/:buildingId", auth, async (req, res) => {
  try {
    const building = await Building.findOne({ _id: req.params.buildingId, owner: req.user.id }).populate({
      path: "floors.rooms.beds.tenantId",
      model: "Tenant",
      select: "name phone email joiningDate rentAmount",
    });
    if (!building) return res.status(404).json({ message: "Building not found." });
    res.json(building);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 6. UPDATE BUILDING
router.put("/:buildingId", auth, async (req, res) => {
  try {
    const { buildingName, address } = req.body;
    const building = await Building.findOneAndUpdate(
      { _id: req.params.buildingId, owner: req.user.id },
      { buildingName, address },
      { new: true }
    );
    if (!building) return res.status(404).json({ message: "Building not found." });
    res.json({ message: "Building updated.", building });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 7. DELETE BUILDING
router.delete("/:buildingId", auth, async (req, res) => {
  try {
    const building = await Building.findOneAndDelete({ _id: req.params.buildingId, owner: req.user.id });
    if (!building) return res.status(404).json({ message: "Building not found." });
    await Tenant.updateMany(
      { buildingId: building._id },
      { buildingId: null, floorId: null, roomId: null, bedId: null, allocationInfo: {} }
    );
    res.json({ message: "Building deleted." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 8. ADD FLOOR
router.post("/:buildingId/floors", auth, async (req, res) => {
  try {
    const { floorNumber, floorName } = req.body;
    if (floorNumber === undefined) return res.status(400).json({ message: "floorNumber is required." });
    const building = await Building.findOne({ _id: req.params.buildingId, owner: req.user.id });
    if (!building) return res.status(404).json({ message: "Building not found." });
    building.floors.push({ floorNumber, floorName, rooms: [] });
    await building.save();
    res.status(201).json({ message: "Floor added.", building });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 9. ADD ROOM
router.post("/:buildingId/floors/:floorId/rooms", auth, async (req, res) => {
  try {
    const { roomNumber, shareType } = req.body;
    if (!roomNumber || !shareType) return res.status(400).json({ message: "roomNumber and shareType are required." });
    const building = await Building.findOne({ _id: req.params.buildingId, owner: req.user.id });
    if (!building) return res.status(404).json({ message: "Building not found." });
    const floor = building.floors.id(req.params.floorId);
    if (!floor) return res.status(404).json({ message: "Floor not found." });
    floor.rooms.push({ roomNumber, shareType: Number(shareType), beds: makeBeds(Number(shareType)) });
    await building.save();
    res.status(201).json({ message: "Room added.", building });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 10. AVAILABLE BEDS
router.get("/:buildingId/floors/:floorId/rooms/:roomId/available-beds", auth, async (req, res) => {
  try {
    const building = await Building.findOne({ _id: req.params.buildingId, owner: req.user.id });
    if (!building) return res.status(404).json({ message: "Building not found." });
    const floor = building.floors.id(req.params.floorId);
    if (!floor) return res.status(404).json({ message: "Floor not found." });
    const room = floor.rooms.id(req.params.roomId);
    if (!room) return res.status(404).json({ message: "Room not found." });
    const availableBeds = room.beds.filter((b) => b.status === "Available");
    res.json({ availableBeds });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 11. UPDATE FLOOR
router.put("/:buildingId/floors/:floorId", auth, async (req, res) => {
  try {
    const { floorNumber, floorName } = req.body;
    if (floorNumber === undefined) return res.status(400).json({ message: "floorNumber is required." });
    const building = await Building.findOne({ _id: req.params.buildingId, owner: req.user.id });
    if (!building) return res.status(404).json({ message: "Building not found." });
    const floor = building.floors.id(req.params.floorId);
    if (!floor) return res.status(404).json({ message: "Floor not found." });
    floor.floorNumber = Number(floorNumber);
    floor.floorName = floorName ?? floor.floorName;
    await building.save();
    res.json({ message: "Floor updated.", building });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 12. DELETE FLOOR
router.delete("/:buildingId/floors/:floorId", auth, async (req, res) => {
  try {
    const building = await Building.findOne({ _id: req.params.buildingId, owner: req.user.id });
    if (!building) return res.status(404).json({ message: "Building not found." });
    const floor = building.floors.id(req.params.floorId);
    if (!floor) return res.status(404).json({ message: "Floor not found." });
    // Vacate all tenants in this floor's rooms
    const roomIds = floor.rooms.map((r) => r._id);
    await Tenant.updateMany(
      { roomId: { $in: roomIds } },
      { buildingId: null, floorId: null, roomId: null, bedId: null, allocationInfo: {} }
    );
    floor.deleteOne();
    await building.save();
    res.json({ message: "Floor deleted.", building });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 13. UPDATE ROOM (roomNumber, shareType — adjusts beds automatically)
router.put("/:buildingId/floors/:floorId/rooms/:roomId", auth, async (req, res) => {
  try {
    const { roomNumber, shareType } = req.body;
    const building = await Building.findOne({ _id: req.params.buildingId, owner: req.user.id });
    if (!building) return res.status(404).json({ message: "Building not found." });
    const floor = building.floors.id(req.params.floorId);
    if (!floor) return res.status(404).json({ message: "Floor not found." });
    const room = floor.rooms.id(req.params.roomId);
    if (!room) return res.status(404).json({ message: "Room not found." });

    if (roomNumber) room.roomNumber = roomNumber;

    if (shareType !== undefined) {
      const newShare = Number(shareType);
      const currentCount = room.beds.length;
      if (newShare > currentCount) {
        // Add extra beds
        for (let i = currentCount + 1; i <= newShare; i++) {
          room.beds.push({ bedNumber: i });
        }
      } else if (newShare < currentCount) {
        // Only remove from tail if those beds are available
        const tailBeds = room.beds.slice(newShare);
        const occupiedInTail = tailBeds.filter((b) => b.status === "Occupied").length;
        if (occupiedInTail > 0) {
          return res.status(400).json({
            message: `Cannot reduce beds — ${occupiedInTail} bed(s) at the end are still occupied. Vacate them first.`,
          });
        }
        // Vacate tenants linked to removed beds (available ones, just clean references)
        const removedBedIds = tailBeds.map((b) => b._id);
        await Tenant.updateMany(
          { bedId: { $in: removedBedIds } },
          { buildingId: null, floorId: null, roomId: null, bedId: null, allocationInfo: {} }
        );
        room.beds = room.beds.slice(0, newShare);
      }
      room.shareType = newShare;
    }

    await building.save();
    res.json({ message: "Room updated.", building });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 14. DELETE ROOM
router.delete("/:buildingId/floors/:floorId/rooms/:roomId", auth, async (req, res) => {
  try {
    const building = await Building.findOne({ _id: req.params.buildingId, owner: req.user.id });
    if (!building) return res.status(404).json({ message: "Building not found." });
    const floor = building.floors.id(req.params.floorId);
    if (!floor) return res.status(404).json({ message: "Floor not found." });
    const room = floor.rooms.id(req.params.roomId);
    if (!room) return res.status(404).json({ message: "Room not found." });
    // Vacate all tenants in this room
    await Tenant.updateMany(
      { roomId: room._id },
      { buildingId: null, floorId: null, roomId: null, bedId: null, allocationInfo: {} }
    );
    room.deleteOne();
    await building.save();
    res.json({ message: "Room deleted.", building });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;