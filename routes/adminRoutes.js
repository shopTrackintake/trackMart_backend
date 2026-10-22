import express from "express";
import {
getAdminStats,
getPendingVendors,
approveVendor,
holdVendor,
getAllVendors,
getAdminProducts,
deleteAdminProduct,
getAdminProductDetails,
getVendorDetails,
deleteVendor,
updateVendorStatus
} from "../controllers/adminController.js";

import { protect } from "../middleware/auth.js";
import { getAdminOrders, updateOrderRefundOrPaymentStatus } from "../controllers/adminController.js";
import {
  getVendorWeeklyEarnings,
  clearVendorPayment,
  getVendorPayoutItems,
  getBuyerRefunds,
  processBuyerRefund,
  getPlatformSettings,
  updatePlatformSettings,
  updateVendorCommission
} from "../controllers/adminController.js";

const router = express.Router();

/* SETTINGS */
router.get("/settings",protect,getPlatformSettings);
router.put("/settings",protect,updatePlatformSettings);
router.put("/vendors/:vendorId/commission",protect,updateVendorCommission);

/* DASHBOARD */
router.get("/vendors/:id",protect,getVendorDetails);
router.put("/vendors/:id/status",protect,updateVendorStatus);
router.get("/stats",protect,getAdminStats);

/* VENDOR PAYOUTS & BUYER REFUNDS */
router.get("/vendor-earnings",protect,getVendorWeeklyEarnings);
router.get("/vendor-payout-items/:vendorId",protect,getVendorPayoutItems);
router.post("/vendor-payout/:vendorId",protect,clearVendorPayment);
router.get("/buyer-refunds",protect,getBuyerRefunds);
router.post("/process-refund",protect,processBuyerRefund);

router.get("/pending-vendors",protect,getPendingVendors);
router.get("/orders",protect,getAdminOrders);
router.put("/orders/update-status",protect,updateOrderRefundOrPaymentStatus);
/* ACTIONS */
router.get("/products",protect,getAdminProducts);
router.delete("/products/:id",protect,deleteAdminProduct);
router.put("/vendors/:vendorId/approve",protect,approveVendor);
router.put("/vendors/:vendorId/hold",protect,holdVendor);
router.delete("/vendors/:vendorId",protect,deleteVendor);
router.get("/products/:id",protect,getAdminProductDetails);
router.get("/vendors",protect,getAllVendors);
export default router;