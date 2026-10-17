import express from "express";
import { getProfile, updateProfile, changePassword } from "../controllers/profileController.js";
import { protect } from "../middleware/auth.js"; // ✅ use same middleware

const router = express.Router();

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;