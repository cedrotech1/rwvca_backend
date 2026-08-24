import express from "express";
import { protect } from "../middlewares/protect.js";
import { requireExecutive } from "../middlewares/requireExecutive.js";
import {
  getEdFullAccessSummary,
  getEdFullAccessModule,
  listModuleComments,
  getNotifyRecipients,
  searchEdNotifyUsers,
  addModuleComment,
  markEdThreadSeen,
} from "../controllers/edFullAccessController.js";

const router = express.Router();

router.get("/summary", protect, requireExecutive, getEdFullAccessSummary);
router.get("/modules/:tab", protect, requireExecutive, getEdFullAccessModule);

router.get("/comments", protect, listModuleComments);
router.get("/recipients", protect, getNotifyRecipients);
router.get("/search-users", protect, searchEdNotifyUsers);
router.post("/comments", protect, addModuleComment);
router.post("/comments/mark-seen", protect, markEdThreadSeen);

export default router;
