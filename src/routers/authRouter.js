import express from "express";
import { login, me, logout, forgotPassword, verifyCode, resetPassword, changePassword, updateProfile, updateSignature } from "../controllers/authController.js";
import { protect } from "../middlewares/protect.js";
import { authLimiter } from "../middlewares/security.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", protect, me);
router.post("/logout", protect, logout);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/verify-code", authLimiter, verifyCode);
router.put("/reset-password", authLimiter, resetPassword);
router.put("/change-password", protect, changePassword);
router.put("/profile", protect, updateProfile);
router.put("/signature", protect, updateSignature);

export default router;
