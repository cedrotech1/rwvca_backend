import express from "express";
import { getLogs, getLogStatistics, exportLogs } from "../controllers/logController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getLogs);
router.get("/statistics", protect, getLogStatistics);
router.get("/export", protect, exportLogs);

export default router;
