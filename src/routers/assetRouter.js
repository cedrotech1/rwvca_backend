import express from "express";
import {
  getAssets,
  getAsset,
  createAsset,
  updateAsset,
  issueAsset,
  returnAsset,
  deleteAsset,
  requestAssetEdit,
  approveAssetEdit,
  rejectAssetEdit,
} from "../controllers/assetController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getAssets);
router.get("/:id", protect, getAsset);
router.post("/", protect, createAsset);
router.put("/:id", protect, updateAsset);
router.post("/:id/request-edit", protect, requestAssetEdit);
router.post("/:id/approve-edit", protect, approveAssetEdit);
router.post("/:id/reject-edit", protect, rejectAssetEdit);
router.post("/:id/issue", protect, issueAsset);
router.post("/:id/return", protect, returnAsset);
router.delete("/:id", protect, deleteAsset);

export default router;
