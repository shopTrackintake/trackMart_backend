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
deleteVendor
} from "../controllers/adminController.js";

import { protect } from "../middleware/auth.js";
import { getAdminOrders } from "../controllers/adminController.js";
import {
getVendorWeeklyEarnings,
clearVendorPayment
} from "../controllers/adminController.js";

const router = express.Router();

/* DASHBOARD */
router.get("/vendors/:id",protect,getVendorDetails);
router.get("/stats",protect,getAdminStats);

/* PENDING VENDORS */
router.get("/vendor-earnings",protect,getVendorWeeklyEarnings);

router.post("/vendor-payout/:vendorId",protect,clearVendorPayment);

router.get("/pending-vendors",protect,getPendingVendors);
router.get("/orders",protect,getAdminOrders);
/* ACTIONS */
router.get("/products",protect,getAdminProducts);
router.delete("/products/:id",protect,deleteAdminProduct);
router.put("/vendors/:vendorId/approve",protect,approveVendor);
router.put("/vendors/:vendorId/hold",protect,holdVendor);
router.delete("/vendors/:vendorId",protect,deleteVendor);
router.get("/products/:id",protect,getAdminProductDetails);
router.get("/vendors",protect,getAllVendors);
export default router;