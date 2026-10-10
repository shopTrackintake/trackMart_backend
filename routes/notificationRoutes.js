import express from "express";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications
} from "../controllers/otificationController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/", protect, getNotifications);
router.put("/read-all", protect, markAllNotificationsRead);
router.delete("/clear-all", protect, clearAllNotifications);
router.put("/:id/read", protect, markNotificationRead);

export default router;