import express from "express";
import { getDashboardOverview } from "../controllers/dashboardController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/overview", protect, getDashboardOverview);

export default router;
