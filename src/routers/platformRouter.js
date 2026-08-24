import express from "express";
import {
  getPlatforms,
  getPlatform,
  createPlatform,
  updatePlatform,
  addPlatformDetail,
  updatePlatformDetail,
  deletePlatformDetail,
  deletePlatform,
} from "../controllers/platformController.js";
import { protect } from "../middlewares/protect.js";
import { requireAdmin } from "../middlewares/roleAccess.js";

const router = express.Router();

router.get("/", protect, getPlatforms);
router.get("/:id", protect, getPlatform);
router.post("/", protect, requireAdmin, createPlatform);
router.put("/:id", protect, requireAdmin, updatePlatform);
router.post("/:id/details", protect, requireAdmin, addPlatformDetail);
router.put("/:id/details/:detailId", protect, requireAdmin, updatePlatformDetail);
router.delete("/:id/details/:detailId", protect, requireAdmin, deletePlatformDetail);
router.delete("/:id", protect, requireAdmin, deletePlatform);

export default router;
