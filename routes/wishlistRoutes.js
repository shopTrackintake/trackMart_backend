import express from "express";
import {
  addToWishlist,
  getWishlist,
  toggleWishlist,
  removeFromWishlist
} from "../controllers/wishlistController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();
router.post("/toggle", protect, toggleWishlist);

router.get("/", protect, getWishlist);

router.post("/", protect, addToWishlist);

router.delete("/:id", protect, removeFromWishlist);


export default router;