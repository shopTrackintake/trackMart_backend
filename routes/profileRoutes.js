import express from "express";
import { getProfile, updateProfile } from "../controllers/profileController.js";
import { protect } from "../middleware/auth.js"; // ✅ use same middleware

const router = express.Router();

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

export default router;