import express from "express";
import { getRoles, createRole, updateRole, deleteRole } from "../controllers/roleController.js";
import { protect } from "../middlewares/protect.js";
import { requireUserManager } from "../middlewares/roleAccess.js";

const router = express.Router();

router.get("/", protect, getRoles);
router.post("/", protect, requireUserManager, createRole);
router.put("/:id", protect, requireUserManager, updateRole);
router.delete("/:id", protect, requireUserManager, deleteRole);

export default router;
