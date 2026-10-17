import express from "express";

import {
createSupportTicket,
getUserTickets,
getAdminTickets,
replyTicket,
deleteTicket
} from "../controllers/supportController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

/* USER */

router.post("/",protect,createSupportTicket);

router.get("/",protect,getUserTickets);

/* ADMIN */

router.get("/admin",protect,getAdminTickets);

router.post("/admin/:id/reply",protect,replyTicket);

router.delete("/admin/:id",protect,deleteTicket);

export default router;