import express from "express";
import Building from "../models/Building.js";
import Tenant from "../models/Tenant.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import jwt from "jsonwebtoken";
import { logActivity } from "../utils/activityLogger.js";

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

const makeBeds = (shareType) => Array.from({ length: shareType }, (_, i) => ({ bedNumber: i + 1 }));

// ── Helper: count ALL beds the user currently has across all buildings ─────────
async function countUserTotalBeds(userId) {
  const buildings = await Building.find({ owner: userId });
  let total = 0;
  for (const b of buildings) {
    for (const f of b.floors) {
      for (const r of f.rooms) {
        total += r.beds.length;
      }
    }
  }
  return total;
}

// ── Helper: get plan bed limit for user ───────────────────────────────────────
// Reads user.planBeds — the accumulated bed limit that increases on each
// approved extension. Falls back to user.plan.beds for legacy users who
// registered before planBeds was introduced.
async function getUserBedLimit(userId) {
  const user = await User.findById(userId).populate("plan");
  if (!user) return null;

  // Primary: use the accumulated planBeds field (set/incremented by approvalroutes)
  if (user.planBeds != null) return user.planBeds;

  // Fallback for existing users who don't have planBeds set yet
  if (user.plan) return user.plan.beds;

  return null; // null = no plan info, skip check
}

// 1. CREATE BUILDING
router.post("/", auth, async (req, res) => {
  try {
    const { buildingName, address } = req.body;
    if (!buildingName) return res.status(400).json({ message: "Building name is required." });
    const building = new Building({ owner: req.user.id, buildingName, address, floors: [] });
    await building.save();
    
    await logActivity(req.user.id, "CREATE", "Building", `Created new building: ${buildingName}`);
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

// 2b. GET PLAN BED USAGE (used by frontend to show remaining beds)
router.get("/plan/bed-usage", auth, async (req, res) => {
  try {
    const bedLimit = await getUserBedLimit(req.user.id);
    const usedBeds = await countUserTotalBeds(req.user.id);
    res.json({
      bedLimit: bedLimit ?? null,
      usedBeds,
      remainingBeds: bedLimit != null ? Math.max(0, bedLimit - usedBeds) : null,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 3. OVERVIEW STATS
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
        buildingId: b._id, buildingName: b.buildingName, address: b.address,
        totalFloors, totalRooms, totalBeds, occupiedBeds,
        availableBeds: totalBeds - occupiedBeds, roomsFilled, roomsAvailable,
        totalTenants: buildingTenants.length, totalRevenue,
      };
    });
    res.json(stats);
  } catch (err) { res.status(500).json({ message: "Server error.", error: err.message }); }
});

// 4. SEARCH ROOM
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
                  tenantInfo = await Tenant.findById(bed.tenantId).select("name phone email joiningDate rentAmount permanentAddress");
                }
                return { ...bed.toObject(), tenant: tenantInfo };
              })
            );
            results.push({
              buildingId: building._id, buildingName: building.buildingName,
              floorId: floor._id, floorNumber: floor.floorNumber, floorName: floor.floorName,
              roomId: room._id, roomNumber: room.roomNumber, shareType: room.shareType, beds: bedsWithTenants,
            });
          }
        }
      }
    }
    if (!results.length) return res.status(404).json({ message: `No room found with number "${roomNumber}".` });
    res.json(results);
  } catch (err) { res.status(500).json({ message: "Server error.", error: err.message }); }
});

// 5. GET SINGLE BUILDING
router.get("/:buildingId", auth, async (req, res) => {
  try {
    const building = await Building.findOne({ _id: req.params.buildingId, owner: req.user.id }).populate({
      path: "floors.rooms.beds.tenantId", model: "Tenant", select: "name phone email joiningDate rentAmount",
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
    const building = await Building.findOne({ _id: req.params.buildingId, owner: req.user.id });
    if (!building) return res.status(404).json({ message: "Building not found." });

    let details = [];
    if (buildingName && buildingName !== building.buildingName) {
      details.push(`Name: ${building.buildingName} ➔ ${buildingName}`);
      building.buildingName = buildingName;
    }
    if (address && address !== building.address) {
      details.push(`Address updated`);
      building.address = address;
    }

    await building.save();
    
    const desc = details.length > 0 
      ? `Updated Building: ${details.join(" | ")}` 
      : `Updated Building: ${building.buildingName} (No changes made)`;

    await logActivity(req.user.id, "UPDATE", "Building", desc);
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
    
    await logActivity(req.user.id, "DELETE", "Building", `Deleted building: ${building.buildingName}`);
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
    
    await logActivity(req.user.id, "CREATE", "Floor", `Added Floor ${floorNumber} to building ${building.buildingName}`);
    res.status(201).json({ message: "Floor added.", building });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 9. ADD ROOM  ── with plan bed-limit check ────────────────────────────────────
router.post("/:buildingId/floors/:floorId/rooms", auth, async (req, res) => {
  try {
    const { roomNumber, shareType } = req.body;
    if (!roomNumber || !shareType) return res.status(400).json({ message: "roomNumber and shareType are required." });

    const newBedCount = Number(shareType);

    // ── Plan bed limit check ──────────────────────────────────────────────────
    const bedLimit = await getUserBedLimit(req.user.id);
    if (bedLimit != null) {
      const usedBeds = await countUserTotalBeds(req.user.id);
      if (usedBeds + newBedCount > bedLimit) {
        return res.status(403).json({
          message: `Plan limit exceeded. Your plan allows ${bedLimit} beds. You have ${usedBeds} beds and are trying to add ${newBedCount} more (total would be ${usedBeds + newBedCount}).`,
          planLimitExceeded: true,
          bedLimit,
          usedBeds,
          remainingBeds: Math.max(0, bedLimit - usedBeds),
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const building = await Building.findOne({ _id: req.params.buildingId, owner: req.user.id });
    if (!building) return res.status(404).json({ message: "Building not found." });
    const floor = building.floors.id(req.params.floorId);
    if (!floor) return res.status(404).json({ message: "Floor not found." });
    floor.rooms.push({ roomNumber, shareType: newBedCount, beds: makeBeds(newBedCount) });
    await building.save();
    
    await logActivity(req.user.id, "CREATE", "Room", `Added Room ${roomNumber} (Share: ${shareType}) to ${building.buildingName}`);
    res.status(201).json({ message: "Room added.", building });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 10. AVAILABLE BEDS (Get request - no log)
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

    const oldFloorNum = floor.floorNumber;
    const oldFloorName = floor.floorName || "None";
    let details = [];

    if (Number(floorNumber) !== oldFloorNum) {
      details.push(`Floor No: ${oldFloorNum} ➔ ${floorNumber}`);
      floor.floorNumber = Number(floorNumber);
    }
    if (floorName !== undefined && floorName !== floor.floorName) {
      details.push(`Name: ${oldFloorName} ➔ ${floorName || "None"}`);
      floor.floorName = floorName;
    }

    await building.save();
    
    const desc = details.length > 0
      ? `Updated Floor in ${building.buildingName}: ${details.join(" | ")}`
      : `Updated Floor ${floor.floorNumber} in ${building.buildingName} (No changes made)`;

    await logActivity(req.user.id, "UPDATE", "Floor", desc);
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
    const roomIds = floor.rooms.map((r) => r._id);
    await Tenant.updateMany(
      { roomId: { $in: roomIds } },
      { buildingId: null, floorId: null, roomId: null, bedId: null, allocationInfo: {} }
    );
    const fn = floor.floorNumber;
    floor.deleteOne();
    await building.save();
    
    await logActivity(req.user.id, "DELETE", "Floor", `Deleted Floor ${fn} from ${building.buildingName}`);
    res.json({ message: "Floor deleted.", building });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// 13. UPDATE ROOM  ── with plan bed-limit check when adding beds ───────────────
router.put("/:buildingId/floors/:floorId/rooms/:roomId", auth, async (req, res) => {
  try {
    const { roomNumber, shareType } = req.body;
    const building = await Building.findOne({ _id: req.params.buildingId, owner: req.user.id });
    if (!building) return res.status(404).json({ message: "Building not found." });
    
    const floor = building.floors.id(req.params.floorId);
    if (!floor) return res.status(404).json({ message: "Floor not found." });
    
    const room = floor.rooms.id(req.params.roomId);
    if (!room) return res.status(404).json({ message: "Room not found." });

    const oldRoomNumber = room.roomNumber;
    const oldShare = room.shareType;
    let details = [];

    // 1. Check if Room Number Changed
    if (roomNumber && roomNumber !== oldRoomNumber) {
      details.push(`Room No: ${oldRoomNumber} ➔ ${roomNumber}`);
      room.roomNumber = roomNumber;
    }

    // 2. Check if Share Type (Beds) Changed
    if (shareType !== undefined) {
      const newShare = Number(shareType);
      if (newShare !== oldShare) {
        const currentCount = room.beds.length;

        if (newShare > currentCount) {
          // ── Plan bed limit check (only when ADDING beds) ──────────────────
          const bedsToAdd = newShare - currentCount;
          const bedLimit = await getUserBedLimit(req.user.id);
          if (bedLimit != null) {
            const usedBeds = await countUserTotalBeds(req.user.id);
            if (usedBeds + bedsToAdd > bedLimit) {
              return res.status(403).json({
                message: `Plan limit exceeded. Your plan allows ${bedLimit} beds. You have ${usedBeds} beds and are trying to add ${bedsToAdd} more (total would be ${usedBeds + bedsToAdd}).`,
                planLimitExceeded: true,
                bedLimit,
                usedBeds,
                remainingBeds: Math.max(0, bedLimit - usedBeds),
              });
            }
          }
          // ─────────────────────────────────────────────────────────────────
          // Add extra beds
          for (let i = currentCount + 1; i <= newShare; i++) {
            room.beds.push({ bedNumber: i });
          }
        } else if (newShare < currentCount) {
          // Remove beds if not occupied
          const tailBeds = room.beds.slice(newShare);
          const occupiedInTail = tailBeds.filter((b) => b.status === "Occupied").length;
          if (occupiedInTail > 0) {
            return res.status(400).json({
              message: `Cannot reduce beds — ${occupiedInTail} bed(s) at the end are still occupied. Vacate them first.`,
            });
          }
          const removedBedIds = tailBeds.map((b) => b._id);
          await Tenant.updateMany(
            { bedId: { $in: removedBedIds } },
            { buildingId: null, floorId: null, roomId: null, bedId: null, allocationInfo: {} }
          );
          room.beds = room.beds.slice(0, newShare);
        }
        details.push(`Occupancy: ${oldShare} ➔ ${newShare} beds`);
        room.shareType = newShare;
      }
    }

    await building.save();

    const desc = details.length > 0
      ? `Updated Room in ${building.buildingName}: ${details.join(" | ")}`
      : `Updated Room ${room.roomNumber} in ${building.buildingName} (No changes made)`;

    await logActivity(req.user.id, "UPDATE", "Room", desc);
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
    
    await Tenant.updateMany(
      { roomId: room._id },
      { buildingId: null, floorId: null, roomId: null, bedId: null, allocationInfo: {} }
    );
    const rn = room.roomNumber;
    room.deleteOne();
    await building.save();
    
    await logActivity(req.user.id, "DELETE", "Room", `Deleted Room ${rn} from ${building.buildingName}`);
    res.json({ message: "Room deleted.", building });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;