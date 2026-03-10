import express from "express";
import { getCustomerStats } from "../controllers/customerController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/dashboard-stats", protect, getCustomerStats);

export default router;