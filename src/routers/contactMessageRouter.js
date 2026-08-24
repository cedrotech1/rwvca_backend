import express from "express";
import {
  getContactMessages,
  getContactMessage,
  updateContactMessageStatus,
  deleteContactMessage,
} from "../controllers/inboxController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getContactMessages);
router.get("/:id", protect, getContactMessage);
router.put("/:id", protect, updateContactMessageStatus);
router.delete("/:id", protect, deleteContactMessage);

export default router;
