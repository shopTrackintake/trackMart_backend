import express from "express";
import {
  addAddress,
  getAddresses,
  updateAddress,
  deleteAddress
} from "../controllers/addressController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/", protect, getAddresses);

router.post("/", protect, addAddress);

router.put("/:id", protect, updateAddress);

router.delete("/:id", protect, deleteAddress);

export default router;