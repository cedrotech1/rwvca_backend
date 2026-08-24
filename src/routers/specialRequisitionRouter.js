import express from "express";
import {
  getVehicleUtilizations,
  getVehicleUtilization,
  createVehicleUtilization,
  updateVehicleUtilization,
  updateVehicleUtilizationStatus,
  authorizeVehicleUtilization,
} from "../controllers/specialRequisitionController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getVehicleUtilizations);
router.get("/:id", protect, getVehicleUtilization);
router.post("/", protect, createVehicleUtilization);
router.put("/:id", protect, updateVehicleUtilization);
router.post("/:id/status", protect, updateVehicleUtilizationStatus);
router.post("/:id/authorize", protect, authorizeVehicleUtilization);

export default router;
