import express from "express";
import {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  addEventImage,
  deleteEventImage,
  deleteEvent,
} from "../controllers/eventController.js";
import { protect } from "../middlewares/protect.js";
import { requireAdmin } from "../middlewares/roleAccess.js";

const router = express.Router();

router.get("/", protect, getEvents);
router.get("/:id", protect, getEvent);
router.post("/", protect, requireAdmin, createEvent);
router.put("/:id", protect, requireAdmin, updateEvent);
router.post("/:id/images", protect, requireAdmin, addEventImage);
router.delete("/:id/images/:imageId", protect, requireAdmin, deleteEventImage);
router.delete("/:id", protect, requireAdmin, deleteEvent);

export default router;
