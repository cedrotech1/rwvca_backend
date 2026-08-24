import express from "express";
import {
  getLeaveSchedules,
  getLeaveSchedule,
  createLeaveSchedule,
  updateLeaveSchedule,
  updateLeaveScheduleStatus,
  markLeaveScheduleRead,
  addLeaveScheduleReply,
  deleteLeaveSchedule,
} from "../controllers/leaveScheduleController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getLeaveSchedules);
router.get("/:id", protect, getLeaveSchedule);
router.post("/", protect, createLeaveSchedule);
router.put("/:id", protect, updateLeaveSchedule);
router.post("/:id/status", protect, updateLeaveScheduleStatus);
router.post("/:id/read", protect, markLeaveScheduleRead);
router.post("/:id/replies", protect, addLeaveScheduleReply);
router.delete("/:id", protect, deleteLeaveSchedule);

export default router;
