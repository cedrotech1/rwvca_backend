import express from "express";
import {
  getLeaveRequests,
  getLeaveRequest,
  getMyLeaveBalance,
  checkLeaveSchedule,
  getLeaveAnalytics,
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  verifyLeaveByHr,
  revertLeaveByHr,
  approveLeave,
  rejectLeave,
} from "../controllers/leaveController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getLeaveRequests);
router.get("/analytics", protect, getLeaveAnalytics);
router.get("/schedule-check", protect, checkLeaveSchedule);
router.get("/balance", protect, getMyLeaveBalance);
router.get("/:id", protect, getLeaveRequest);
router.post("/", protect, createLeaveRequest);
router.put("/:id", protect, updateLeaveRequest);
router.delete("/:id", protect, deleteLeaveRequest);
router.post("/:id/hr-verify", protect, verifyLeaveByHr);
router.post("/:id/hr-revert", protect, revertLeaveByHr);
router.post("/:id/approve", protect, approveLeave);
router.post("/:id/reject", protect, rejectLeave);

export default router;
