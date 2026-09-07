import asyncHandler from "express-async-handler";
import { getSuggestedPrompts, normalizeAudience } from "../constants/chatAssistantPrompt.js";
import {
  isChatAssistantEnabled,
  resetChatSession,
  sendChatMessage,
} from "../services/chatAssistantService.js";
import { ok, fail } from "../utils/apiResponse.js";

export const getAssistantConfig = asyncHandler(async (req, res) => {
  const audience = normalizeAudience(req.query.audience);
  return ok(res, {
    enabled: isChatAssistantEnabled(),
    audience,
    suggestedPrompts: getSuggestedPrompts(audience),
  });
});

export const postChatMessage = asyncHandler(async (req, res) => {
  if (!isChatAssistantEnabled()) {
    return fail(res, "Chat assistant is not available", 503);
  }

  const { message, agentId, audience } = req.body || {};
  const mode = req.user ? normalizeAudience(audience || "staff") : "public";

  try {
    const data = await sendChatMessage({
      message,
      agentId: agentId || null,
      user: req.user,
      audience: mode,
    });
    return ok(res, data);
  } catch (error) {
    const status = error.response?.status;
    const apiMessage = error.response?.data?.message || error.response?.data?.error;
    const rawMessage = String(error.message || "");
    const isTimeout =
      error.code === "ECONNABORTED" ||
      /timeout/i.test(rawMessage) ||
      /timeout of \d+ms exceeded/i.test(String(apiMessage || ""));

    if (isTimeout) {
      return fail(res, "IGITI is taking longer than usual. Please wait a moment and try again.", 504);
    }

    if (status === 401 || status === 403) {
      return fail(res, "Assistant authentication failed. Check server configuration.", 503);
    }
    if (status === 409) {
      return fail(res, "Assistant is busy. Please wait a moment and try again.", 409);
    }

    // Never expose raw axios timeout / internal transport messages to the UI.
    if (/ECONNABORTED|ETIMEDOUT|socket hang up|network/i.test(rawMessage)) {
      return fail(res, "Could not reach IGITI right now. Please try again.", 502);
    }

    return fail(res, apiMessage || error.message || "Assistant request failed", 502);
  }
});

export const resetChat = asyncHandler(async (req, res) => {
  const { agentId } = req.body || {};
  if (agentId) {
    await resetChatSession(agentId);
  }
  return ok(res, { reset: true });
});
