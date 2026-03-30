import express from "express";
import {
  sendMessage,
  getMessages,
  markAsRead
} from "../controllers/contactController.js";

import { protect } from "../middleware/auth.js";
import { optionalAuth } from "../middleware/optionalAuth.js";

const router = express.Router();

/* USER (guest + login both) */
router.post("/", optionalAuth, sendMessage);

/* ADMIN */
router.get("/", protect, getMessages);
router.put("/:id", protect, markAsRead);

export default router;