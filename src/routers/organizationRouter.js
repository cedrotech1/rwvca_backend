import express from "express";
import {
  getOrganizationUnits,
  getOrganizationUnit,
  createOrganizationUnit,
  updateOrganizationUnit,
  deleteOrganizationUnit,
} from "../controllers/organizationController.js";
import { protect } from "../middlewares/protect.js";
import { requireAdmin } from "../middlewares/roleAccess.js";

const router = express.Router();

router.get("/", protect, getOrganizationUnits);
router.get("/:id", protect, getOrganizationUnit);
router.post("/", protect, requireAdmin, createOrganizationUnit);
router.put("/:id", protect, requireAdmin, updateOrganizationUnit);
router.delete("/:id", protect, requireAdmin, deleteOrganizationUnit);

export default router;
