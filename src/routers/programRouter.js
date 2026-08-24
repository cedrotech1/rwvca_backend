import express from "express";
import {
  getPrograms,
  getProgram,
  createProgram,
  updateProgram,
  addProgramImage,
  deleteProgramImage,
  deleteProgram,
} from "../controllers/programController.js";
import { protect } from "../middlewares/protect.js";
import { requireAdmin } from "../middlewares/roleAccess.js";

const router = express.Router();

router.get("/", protect, getPrograms);
router.get("/:id", protect, getProgram);
router.post("/", protect, requireAdmin, createProgram);
router.put("/:id", protect, requireAdmin, updateProgram);
router.post("/:id/images", protect, requireAdmin, addProgramImage);
router.delete("/:id/images/:imageId", protect, requireAdmin, deleteProgramImage);
router.delete("/:id", protect, requireAdmin, deleteProgram);

export default router;
