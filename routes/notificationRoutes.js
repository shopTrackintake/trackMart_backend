import express from "express";
import {
  getNotifications,
  markNotificationRead
} from "../controllers/otificationController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/", protect, getNotifications);

router.put("/:id/read", protect, markNotificationRead);

export default router;