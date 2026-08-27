import express from "express";
import {
  getProcurementDashboard,
  getProcurements,
  getProcurement,
  createProcurement,
  updateProcurement,
  deleteProcurement,
  addProcurementDocument,
  deleteProcurementDocument,
  addProcurementNote,
} from "../controllers/procurementController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/dashboard", protect, getProcurementDashboard);
router.get("/", protect, getProcurements);
router.get("/:id", protect, getProcurement);
router.post("/", protect, createProcurement);
router.put("/:id", protect, updateProcurement);
router.delete("/:id", protect, deleteProcurement);
router.post("/:id/documents", protect, addProcurementDocument);
router.delete("/documents/:documentId", protect, deleteProcurementDocument);
router.post("/:id/notes", protect, addProcurementNote);

export default router;
