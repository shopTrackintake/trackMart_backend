import express from "express";

import {
createSupportTicket,
getUserTickets,
getAdminTickets,
replyTicket
} from "../controllers/supportController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

/* USER */

router.post("/",protect,createSupportTicket);

router.get("/",protect,getUserTickets);

/* ADMIN */

router.get("/admin",protect,getAdminTickets);

router.post("/admin/:id/reply",protect,replyTicket);

export default router;