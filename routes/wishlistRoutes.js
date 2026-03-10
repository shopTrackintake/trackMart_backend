import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getWishlist,
  addWishlist,
  removeWishlist,
  toggleWishlist
} from "../controllers/wishlistController.js";

const router = express.Router();

/* GET USER WISHLIST */
router.get("/", protect, getWishlist);

/* ADD */
router.post("/", protect, addWishlist);

/* TOGGLE */
router.post("/toggle/:productId", protect, toggleWishlist);

/* REMOVE */
router.delete("/:id", protect, removeWishlist);

export default router;
