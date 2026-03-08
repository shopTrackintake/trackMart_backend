import express from "express";
import { createOrder,getUserOrders } from "../controllers/orderController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/", protect, createOrder);
router.get("/", protect, getUserOrders);
export default router;