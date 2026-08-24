import express from "express";
import { getCompanyInfo, updateCompanyInfo } from "../controllers/companyController.js";
import { protect } from "../middlewares/protect.js";
import { requireAdmin } from "../middlewares/roleAccess.js";

const router = express.Router();

router.get("/", protect, getCompanyInfo);
router.put("/", protect, requireAdmin, updateCompanyInfo);

export default router;
