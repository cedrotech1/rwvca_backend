import express from "express";
import { getRoles, createRole, updateRole, deleteRole } from "../controllers/roleController.js";
import {
  getPrivileges,
  getRolePrivilegeMatrixHandler,
  getRoleUsers,
  restoreRolePrivilegeDefaults,
  updateRolePrivileges,
} from "../controllers/privilegeController.js";
import { protect } from "../middlewares/protect.js";
import { requireUserManager } from "../middlewares/roleAccess.js";

const router = express.Router();

router.get("/privileges/catalog", protect, getPrivileges);
router.get("/privileges/matrix", protect, getRolePrivilegeMatrixHandler);
router.get("/:roleId/users", protect, getRoleUsers);
router.put("/:roleId/privileges", protect, updateRolePrivileges);
router.post("/:roleId/privileges/restore-defaults", protect, restoreRolePrivilegeDefaults);

router.get("/", protect, getRoles);
router.post("/", protect, requireUserManager, createRole);
router.put("/:id", protect, requireUserManager, updateRole);
router.delete("/:id", protect, requireUserManager, deleteRole);

export default router;
