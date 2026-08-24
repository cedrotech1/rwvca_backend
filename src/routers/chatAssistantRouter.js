import express from "express";
import rateLimit from "express-rate-limit";
import { optionalProtect } from "../middlewares/protect.js";
import {
  getAssistantConfig,
  postChatMessage,
  resetChat,
} from "../controllers/chatAssistantController.js";

const router = express.Router();

const assistantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_ASSISTANT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many assistant requests. Please try again later." },
});

router.get("/config", optionalProtect, getAssistantConfig);
router.post("/chat", optionalProtect, assistantLimiter, postChatMessage);
router.post("/reset", optionalProtect, resetChat);

export default router;
