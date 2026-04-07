import ActivityLog from "../models/ActivityLog.js";

/**
 * Utility to log user actions across the app
 */
export const logActivity = async (ownerId, actionType, entityType, description, metadata = {}) => {
  try {
    await ActivityLog.create({
      owner: ownerId,
      actionType,
      entityType,
      description,
      metadata,
    });
  } catch (err) {
    console.error("❌ Failed to log activity:", err.message);
  }
};