import express from "express";
import { 
  createOrder, 
  getUserOrders, 
  getOrderById, 
  updatePaymentStatus, 
  cancelOrder,
  cancelOrderItem
} from "../controllers/orderController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/", protect, createOrder);
router.get("/", protect, getUserOrders);
router.get("/:id", protect, getOrderById);
router.patch("/payment-status", protect, updatePaymentStatus);
router.post("/cancel", protect, cancelOrder);
router.post("/cancel-item", protect, cancelOrderItem);

export default router;