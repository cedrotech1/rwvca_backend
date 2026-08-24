import express from "express";
import {
  getRequisitions,
  getRequisitionAnalytics,
  getRequisition,
  createRequisition,
  updateRequisition,
  updateRequisitionStatus,
  authorizeRequisition,
  updateViewerStatus,
  updateFinanceStatus,
} from "../controllers/requisitionController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getRequisitions);
router.get("/analytics", protect, getRequisitionAnalytics);
router.get("/:id", protect, getRequisition);
router.post("/", protect, createRequisition);
router.put("/:id", protect, updateRequisition);
router.post("/:id/status", protect, updateRequisitionStatus);
router.post("/:id/authorize", protect, authorizeRequisition);
router.put("/:id/viewer", protect, updateViewerStatus);
router.put("/:id/finance", protect, updateFinanceStatus);

export default router;
