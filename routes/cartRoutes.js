import express from "express";
import { 
  addToCart, 
  getCart, 
  mergeCart, 
  removeFromCart, 
  clearCart 
} from "../controllers/cartController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/", protect, getCart);
router.post("/", protect, addToCart);
router.post("/merge", protect, mergeCart);
router.delete("/clear", protect, clearCart);
router.delete("/:productId", protect, removeFromCart);

export default router;