import express from "express";
import {getVendorOrderDetails,confirmVendorOrder, markOrderDelivered,getVendorStats,getVendorOrders,getVendorEarnings } from "../controllers/vendorController.js";
import { protect } from "../middleware/auth.js";
import { getVendorPayments } from "../controllers/vendorController.js";
const router = express.Router();

router.get("/stats", protect, getVendorStats);
router.get("/orders", protect, getVendorOrders);
router.get("/earnings", protect, getVendorEarnings);
router.get("/orders/:id", protect, getVendorOrderDetails);
router.put("/orders/:id/deliver", protect, markOrderDelivered);
router.put("/orders/:id/confirm", protect, confirmVendorOrder);
router.get("/payments",protect,getVendorPayments);

export default router;