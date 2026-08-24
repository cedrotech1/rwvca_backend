import express from "express";
import {
  getReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
  addReportComment,
  addReportAttachment,
  markReportRead,
} from "../controllers/reportController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getReports);
router.get("/:id", protect, getReport);
router.post("/", protect, createReport);
router.put("/:id", protect, updateReport);
router.delete("/:id", protect, deleteReport);
router.post("/:id/comments", protect, addReportComment);
router.post("/:id/attachments", protect, addReportAttachment);
router.post("/:id/read", protect, markReportRead);

export default router;
