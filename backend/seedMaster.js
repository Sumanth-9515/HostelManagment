/**
 * seedMaster.js
 * Run once to create the master admin account.
 * Usage: node seedMaster.js
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const MASTER = {
  name: "Master Admin",
  owner: "Sumanth Reddy",
  ph: "0000000000",
  email: "mykalasumanthreddy@gmail.com",
  password: "Sumanth@2026",
  address: "Master HQ",
  role: "master",
};

async function seed() {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("✅ Connected to MongoDB");

  const existing = await User.findOne({ email: MASTER.email });
  if (existing) {
    console.log("⚠️  Master account already exists. Skipping.");
    process.exit(0);
  }

  const hashed = await bcrypt.hash(MASTER.password, 10);
  const master = new User({ ...MASTER, password: hashed });
  await master.save();

  console.log("✅ Master account created:");
  console.log(`   Email   : ${MASTER.email}`);
  console.log(`   Password: ${MASTER.password}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
