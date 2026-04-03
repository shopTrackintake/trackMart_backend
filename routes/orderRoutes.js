import express from "express";
import { createOrder,getUserOrders,updatePaymentStatus } from "../controllers/orderController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/", protect, createOrder);
router.get("/", protect, getUserOrders);
router.patch("/payment-status", protect, updatePaymentStatus);
export default router;