import express from "express";
import {
  getMembershipReports,
  getMembershipReportCoverage,
  getMembershipAnalytics,
  getMembershipReportPrintOptions,
  getMembershipReportPrintBundle,
  getMembershipReportShareUsers,
  createMembershipMissedShare,
  getMembershipMissedShares,
  getMembershipMissedShare,
  addMembershipMissedShareComment,
  markMembershipMissedShareSeen,
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
router.get("/print-options", protect, getMembershipReportPrintOptions);
router.get("/print-bundle", protect, getMembershipReportPrintBundle);
router.get("/share-users", protect, getMembershipReportShareUsers);
router.get("/missed-shares", protect, getMembershipMissedShares);
router.post("/missed-shares", protect, createMembershipMissedShare);
router.get("/missed-shares/:id", protect, getMembershipMissedShare);
router.post("/missed-shares/:id/comments", protect, addMembershipMissedShareComment);
router.post("/missed-shares/:id/seen", protect, markMembershipMissedShareSeen);
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
