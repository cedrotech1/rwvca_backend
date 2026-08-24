import express from "express";
import { getTickets, getTicket, createTicket, updateTicket, addTicketReply, assignTicket, deleteTicket } from "../controllers/ticketController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getTickets);
router.get("/:id", protect, getTicket);
router.post("/", protect, createTicket);
router.put("/:id", protect, updateTicket);
router.post("/:id/replies", protect, addTicketReply);
router.post("/:id/assign", protect, assignTicket);
router.delete("/:id", protect, deleteTicket);

export default router;
