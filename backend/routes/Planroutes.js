// routes/planRoutes.js — PATCH /:id/edit (separate from /:id/toggle to avoid route collision)
import express from "express";
import Plan from "../models/Plan.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// ── Auth middleware (master only) ─────────────────────────────────────────────
function masterAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "No token." });
  try {
    const decoded = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET);
    if (decoded.role !== "master") return res.status(403).json({ message: "Master only." });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token." });
  }
}

// ── GET all active plans (public — landing page) ──────────────────────────────
router.get("/", async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── GET all plans including inactive (master) ─────────────────────────────────
router.get("/all", masterAuth, async (req, res) => {
  try {
    const plans = await Plan.find().sort({ price: 1 });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── POST create plan ──────────────────────────────────────────────────────────
router.post("/", masterAuth, async (req, res) => {
  try {
    const { name, price, days, beds } = req.body;
    if (!name || price === undefined || !days || !beds)
      return res.status(400).json({ message: "All fields are required." });

    const plan = new Plan({
      name,
      price:  Number(price),
      days:   Number(days),
      beds:   Number(beds),
      isFree: Number(price) === 0,
    });
    await plan.save();
    res.status(201).json({ message: "Plan created.", plan });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── PATCH edit plan — uses /edit suffix to avoid colliding with /toggle ───────
// Frontend must call: PATCH /api/plans/:id/edit
router.patch("/:id/edit", masterAuth, async (req, res) => {
  try {
    const { name, price, days, beds } = req.body;
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found." });

    if (name  !== undefined) plan.name  = String(name).trim();
    if (price !== undefined) { plan.price = Number(price); plan.isFree = Number(price) === 0; }
    if (days  !== undefined) plan.days  = Number(days);
    if (beds  !== undefined) plan.beds  = Number(beds);

    await plan.save();
    res.json({ message: "Plan updated.", plan });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── PATCH toggle active ───────────────────────────────────────────────────────
router.patch("/:id/toggle", masterAuth, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found." });
    plan.isActive = !plan.isActive;
    await plan.save();
    res.json({ message: "Updated.", plan });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── DELETE plan ───────────────────────────────────────────────────────────────
router.delete("/:id", masterAuth, async (req, res) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ message: "Plan deleted." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;