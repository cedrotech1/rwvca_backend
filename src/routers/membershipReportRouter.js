import express from "express";
import {
  getMembershipReports,
  getMembershipReportCoverage,
  getMembershipAnalytics,
  getMembershipReport,
  createMembershipReport,
  updateMembershipReport,
  approveMembershipReport,
  revertMembershipReport,
  addMembershipReportComment,
  assignMembershipReportReviewer,
  markMembershipReportReviewed,
  removeMembershipReportReviewer,
} from "../controllers/membershipReportController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getMembershipReports);
router.get("/analytics", protect, getMembershipAnalytics);
router.get("/coverage", protect, getMembershipReportCoverage);
router.get("/:id", protect, getMembershipReport);
router.post("/", protect, createMembershipReport);
router.put("/:id", protect, updateMembershipReport);
router.post("/:id/approve", protect, approveMembershipReport);
router.post("/:id/revert", protect, revertMembershipReport);
router.post("/:id/comments", protect, addMembershipReportComment);
router.post("/:id/reviewers", protect, assignMembershipReportReviewer);
router.post("/:id/review", protect, markMembershipReportReviewed);
router.post("/:id/reviewers/remove", protect, removeMembershipReportReviewer);

export default router;
