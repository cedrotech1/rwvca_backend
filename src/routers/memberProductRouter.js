import express from "express";
import {
  getMemberProducts,
  getMemberProduct,
  createMemberProduct,
  updateMemberProduct,
  deleteMemberProduct,
} from "../controllers/memberProductController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getMemberProducts);
router.get("/:id", protect, getMemberProduct);
router.post("/", protect, createMemberProduct);
router.put("/:id", protect, updateMemberProduct);
router.delete("/:id", protect, deleteMemberProduct);

export default router;
