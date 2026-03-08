import express from "express";
import {
  createProduct,
  getVendorProducts,
  deleteProduct,
  getProducts
} from "../controllers/productController.js";

import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

/* GET VENDOR PRODUCTS */
router.get("/vendor", protect, getVendorProducts);

/* GET ALL PRODUCTS */
router.get("/", getProducts);

/* CREATE PRODUCT */
router.post(
  "/",
  protect,
  upload.fields([
    { name: "product_image", maxCount: 1 },
    { name: "ingredients_image", maxCount: 1 }
  ]),
  createProduct
);

/* DELETE PRODUCT */
router.delete("/:id", protect, deleteProduct);

export default router;