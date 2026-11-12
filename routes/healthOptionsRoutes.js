import express from "express";
import {
  getAllOptions,
  getCareTypes,
  createCareType,
  updateCareType,
  deleteCareType,
  getHealthConcerns,
  createHealthConcern,
  updateHealthConcern,
  deleteHealthConcern
} from "../controllers/healthOptionsController.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Public: Get all options, care types, or health concerns
router.get("/", getAllOptions);
router.get("/care-types", getCareTypes);
router.get("/concerns", getHealthConcerns);

// Admin-only: Care Types CRUD
router.post("/care-types", protect, requireAdmin, createCareType);
router.put("/care-types/:id", protect, requireAdmin, updateCareType);
router.delete("/care-types/:id", protect, requireAdmin, deleteCareType);

// Admin-only: Health Concerns CRUD
router.post("/concerns", protect, requireAdmin, createHealthConcern);
router.put("/concerns/:id", protect, requireAdmin, updateHealthConcern);
router.delete("/concerns/:id", protect, requireAdmin, deleteHealthConcern);

export default router;

