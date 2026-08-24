import express from "express";
import {
  getMembers,
  getMember,
  getMemberMeta,
  getMemberStatistics,
  createMember,
  updateMember,
  deleteMember,
  upsertMemberYearPayment,
} from "../controllers/memberController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getMembers);
router.get("/meta", protect, getMemberMeta);
router.get("/statistics", protect, getMemberStatistics);
router.get("/:id", protect, getMember);
router.post("/", protect, createMember);
router.put("/:id", protect, updateMember);
router.delete("/:id", protect, deleteMember);
router.put("/:id/year-payments", protect, upsertMemberYearPayment);

export default router;
