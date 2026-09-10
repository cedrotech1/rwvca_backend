import express from "express";
import {
  getAllUsers,
  getOneUser,
  getUsersByDepartment,
  getEmployeesOverview,
  getEmployeeAnalysis,
  getMyEmployeeAnalysis,
  addUser,
  updateUser,
  deleteUser,
  restoreUser,
  setUserActive,
  setSignatureApproved,
  getUserLeaveDays,
  saveUserLeaveDays,
  deleteUserLeaveDays,
  adminResetPassword,
} from "../controllers/userController.js";
import { protect } from "../middlewares/protect.js";
import { requireUserManager } from "../middlewares/roleAccess.js";

const router = express.Router();

router.get("/", protect, getAllUsers);
router.get("/analysis/overview", protect, getEmployeesOverview);
router.get("/me/analysis", protect, getMyEmployeeAnalysis);
router.get("/department/:deptId", protect, getUsersByDepartment);
router.get("/:id/analysis", protect, getEmployeeAnalysis);
router.get("/:id/leave-days", protect, getUserLeaveDays);
router.post("/:id/leave-days", protect, requireUserManager, saveUserLeaveDays);
router.delete("/:id/leave-days/:leaveId", protect, requireUserManager, deleteUserLeaveDays);
router.post("/:id/reset-password", protect, requireUserManager, adminResetPassword);
router.get("/:id", protect, getOneUser);
router.post("/", protect, requireUserManager, addUser);
router.put("/:id", protect, updateUser);
router.delete("/:id", protect, requireUserManager, deleteUser);
router.post("/:id/restore", protect, requireUserManager, restoreUser);
router.put("/:id/activate", protect, requireUserManager, setUserActive(1));
router.put("/:id/deactivate", protect, requireUserManager, setUserActive(0));
router.put("/:id/signature/approve", protect, requireUserManager, setSignatureApproved(true));
router.put("/:id/signature/reject", protect, requireUserManager, setSignatureApproved(false));

export default router;
