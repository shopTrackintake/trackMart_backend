import express from "express";
import { getItemTracking, updateLocation } from "../controllers/trackController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.patch("/update-location", updateLocation);
//  COMMON ROUTE FOR ALL
router.get("/:itemId", protect, getItemTracking);


export default router;