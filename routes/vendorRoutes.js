import express from "express";
import {getVendorOrderDetails,confirmItem, markOrderDelivered,getVendorStats,getVendorOrders,getVendorEarnings } from "../controllers/vendorController.js";
import { protect } from "../middleware/auth.js";
import { getVendorPayments } from "../controllers/vendorController.js";
const router = express.Router();

router.get("/stats", protect, getVendorStats);
router.get("/orders", protect, getVendorOrders);
router.get("/earnings", protect, getVendorEarnings);
router.get("/orders/:id", protect, getVendorOrderDetails);
router.patch("/deliver-item", protect, markOrderDelivered);
router.patch("/confirm-item", protect, confirmItem);
router.get("/payments",protect,getVendorPayments);

export default router;