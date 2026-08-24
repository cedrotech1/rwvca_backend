import express from "express";
import { getSystemSettings, updateSystemSettings, sendTestEmail } from "../controllers/settingsController.js";
import { protect } from "../middlewares/protect.js";
import { requireAdmin } from "../middlewares/roleAccess.js";

const router = express.Router();

router.get("/", protect, getSystemSettings);
router.put("/", protect, requireAdmin, updateSystemSettings);
router.post("/test-email", protect, requireAdmin, sendTestEmail);

export default router;
