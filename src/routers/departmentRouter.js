import express from "express";
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from "../controllers/departmentController.js";
import { protect } from "../middlewares/protect.js";
import { requireUserManager } from "../middlewares/roleAccess.js";

const router = express.Router();

router.get("/", protect, getDepartments);
router.post("/", protect, requireUserManager, createDepartment);
router.put("/:id", protect, requireUserManager, updateDepartment);
router.delete("/:id", protect, requireUserManager, deleteDepartment);

export default router;
