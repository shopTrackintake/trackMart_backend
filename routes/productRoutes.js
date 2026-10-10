import express from "express";
import {
  createProduct,
  updateProduct,
  getVendorProducts,
  deleteProduct,
  getProductById,
  getProducts,
  toggleProductStatus
} from "../controllers/productController.js";

import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

/* ================= GET ALL PRODUCTS (WITH SEARCH) ================= */
router.get("/", getProducts);

router.get("/vendor", protect, getVendorProducts);

router.get("/:id", getProductById);

/* TOGGLE AVAILABILITY / ACTIVE STATUS */
router.patch("/:id/toggle-status", protect, toggleProductStatus);

/* CREATE */
router.post(
  "/",
  protect,
  upload.fields([
    { name: "product_image", maxCount: 1 },
    { name: "ingredients_image", maxCount: 1 }
  ]),
  createProduct
);

/* UPDATE */
router.put(
  "/:id",
  protect,
  upload.fields([
    { name: "product_image", maxCount: 1 },
    { name: "ingredients_image", maxCount: 1 }
  ]),
  updateProduct
);

/* DELETE */
router.delete("/:id", protect, deleteProduct);

export default router;