import express from "express";
import {
  getAttendanceSessions,
  getAttendanceSession,
  createAttendanceSession,
  updateAttendanceSession,
  addAttendanceUsers,
  signAttendance,
  deleteAttendanceSession,
} from "../controllers/attendanceController.js";
import { protect } from "../middlewares/protect.js";
import { requireUserManager } from "../middlewares/roleAccess.js";

const router = express.Router();

router.get("/", protect, getAttendanceSessions);
router.get("/:id", protect, getAttendanceSession);
router.post("/", protect, requireUserManager, createAttendanceSession);
router.put("/:id", protect, requireUserManager, updateAttendanceSession);
router.post("/:id/users", protect, requireUserManager, addAttendanceUsers);
router.post("/:id/sign", protect, signAttendance);
router.delete("/:id", protect, requireUserManager, deleteAttendanceSession);

export default router;
