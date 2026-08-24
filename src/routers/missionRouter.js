import express from "express";
import {
  getMissions,
  getMissionCounts,
  getMission,
  createMission,
  updateMission,
  deleteMission,
  verifyMissionByHr,
  revertMissionByHr,
  approveMission,
  rejectMission,
  updateMissionSignatureChoice,
} from "../controllers/missionController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getMissions);
router.get("/counts", protect, getMissionCounts);
router.get("/:id", protect, getMission);
router.post("/", protect, createMission);
router.put("/:id", protect, updateMission);
router.delete("/:id", protect, deleteMission);
router.post("/:id/hr-verify", protect, verifyMissionByHr);
router.post("/:id/hr-revert", protect, revertMissionByHr);
router.post("/:id/approve", protect, approveMission);
router.post("/:id/reject", protect, rejectMission);
router.put("/:id/signature-choice", protect, updateMissionSignatureChoice);

export default router;
