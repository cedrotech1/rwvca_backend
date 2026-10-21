import express from "express";
import {
  listSupplyRequisitions,
  getSupplyRequisition,
  createSupplyRequisition,
  updateSupplyRequisition,
  submitSupplyRequisition,
  assignSupplyRequisition,
  approveSupplyRequisition,
  rejectSupplyRequisition,
  revertSupplyRequisition,
  authorizeSupplyRequisition,
} from "../controllers/supplyRequisitionController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.use(protect);

router.get("/", listSupplyRequisitions);
router.get("/:id", getSupplyRequisition);
router.post("/", createSupplyRequisition);
router.put("/:id", updateSupplyRequisition);
router.post("/:id/submit", submitSupplyRequisition);
router.post("/:id/assign", assignSupplyRequisition);
router.post("/:id/approve", approveSupplyRequisition);
router.post("/:id/reject", rejectSupplyRequisition);
router.post("/:id/revert", revertSupplyRequisition);
router.post("/:id/authorize", authorizeSupplyRequisition);

export default router;
