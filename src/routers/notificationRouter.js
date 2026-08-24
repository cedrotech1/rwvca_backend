import express from "express";
import {
  getNotifications,
  unreadCount,
  markRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
} from "../controllers/notificationController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getNotifications);
router.get("/unread-count", protect, unreadCount);
router.put("/read-all", protect, markAllRead);
router.delete("/", protect, deleteAllNotifications);
router.put("/:id/read", protect, markRead);
router.delete("/:id", protect, deleteNotification);

export default router;
