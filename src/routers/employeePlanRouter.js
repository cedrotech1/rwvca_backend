import express from "express";
import {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  updatePlanStatus,
  setCollaborators,
  respondCollaborator,
  listComments,
  addComment,
  createReport,
  listReports,
  getStaffMonitoring,
} from "../controllers/employeePlanController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.use(protect);

router.get("/monitoring", getStaffMonitoring);
router.get("/reports", listReports);
router.post("/reports", createReport);

router.get("/", listPlans);
router.post("/", createPlan);
router.get("/:id", getPlan);
router.put("/:id", updatePlan);
router.delete("/:id", deletePlan);
router.post("/:id/status", updatePlanStatus);
router.put("/:id/collaborators", setCollaborators);
router.post("/:id/collaborators/respond", respondCollaborator);
router.get("/:id/comments", listComments);
router.post("/:id/comments", addComment);

export default router;
