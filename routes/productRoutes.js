import express from "express";
import {
  createProduct,
  getVendorProducts,
  deleteProduct,
  getProductById,
  getProducts
} from "../controllers/productController.js";

import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

/* ================= GET ALL PRODUCTS (WITH SEARCH) ================= */
router.get("/", getProducts);


router.get("/vendor", protect, getVendorProducts);


router.get("/:id", getProductById);


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

/* DELETE */
router.delete("/:id", protect, deleteProduct);


export default router;