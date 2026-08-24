import axios from "axios";
import {
  buildAssistantSystemPrompt,
  buildFollowUpPrompt,
  normalizeAudience,
} from "../constants/chatAssistantPrompt.js";
import { buildPublicKnowledgePack } from "./chatAssistantKnowledge.js";

const CURSOR_API_BASE = "https://api.cursor.com";
const TERMINAL_STATUSES = new Set(["FINISHED", "ERROR", "CANCELLED", "EXPIRED"]);
const POLL_INTERVAL_MS = 2000;
const REQUEST_TIMEOUT_MS = Number(process.env.CURSOR_REQUEST_TIMEOUT_MS || 90000);
const MAX_POLL_MS = Number(process.env.CURSOR_MAX_POLL_MS || 180000);

function getApiKey() {
  return process.env.CURSOR_API_KEY?.trim() || "";
}

function getModelId() {
  return process.env.CURSOR_MODEL?.trim() || "claude-haiku-4-5";
}

function cursorClient() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Chat assistant is not configured (missing CURSOR_API_KEY)");
  }

  return axios.create({
    baseURL: CURSOR_API_BASE,
    auth: { username: apiKey, password: "" },
    headers: { "Content-Type": "application/json" },
    timeout: REQUEST_TIMEOUT_MS,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRun(client, agentId, runId) {
  const started = Date.now();

  while (Date.now() - started < MAX_POLL_MS) {
    const { data: run } = await client.get(`/v1/agents/${agentId}/runs/${runId}`);

    if (TERMINAL_STATUSES.has(run.status)) {
      if (run.status === "FINISHED") {
        return {
          reply: run.result || "I could not generate a response. Please try again.",
          runId: run.id,
          status: run.status,
        };
      }

      const message =
        run.status === "ERROR"
          ? "The assistant encountered an error. Please try again."
          : "The assistant request was cancelled or expired. Please try again.";

      throw new Error(message);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("The assistant took too long to respond. Please try again.");
}

function sanitizeAssistantReply(reply) {
  const text = String(reply || "").trim();
  if (!text) return "I could not generate a response. Please try again.";

  const looksLikeRepoExcuse =
    /without repository access|need.*(repo|repository|codebase|website code)|clone the repository|set up an assistant/i.test(
      text
    );

  if (!looksLikeRepoExcuse) return text;

  return [
    "**RWVCA** is the **Rwanda Wood Value Chain Association** — a national association for stakeholders across Rwanda's wood value chain (forestry, processing, and trade).",
    "",
    "It focuses on collaboration, advocacy, membership support, training, market access, and sustainable development of the wood industry.",
    "",
    "You can explore more on the public website:",
    "- **About Us** — who we are, mission, and vision",
    "- **Membership** — categories and how to join",
    "- **Programs** / **Events** — current activities",
    "- **Contact** — email, phone, and office location",
    "",
    "Ask me anything else about membership, events, programs, or how to reach RWVCA.",
  ].join("\n");
}

export function isChatAssistantEnabled() {
  if (process.env.CHAT_ASSISTANT_ENABLED === "0" || process.env.CHAT_ASSISTANT_ENABLED === "false") {
    return false;
  }
  return Boolean(getApiKey());
}

export async function sendChatMessage({ message, agentId, user, audience = "staff" }) {
  const trimmed = String(message || "").trim();
  if (!trimmed) {
    throw new Error("Message is required");
  }
  if (trimmed.length > 4000) {
    throw new Error("Message is too long (max 4000 characters)");
  }

  const client = cursorClient();
  const model = getModelId();
  const mode = normalizeAudience(audience);
  let activeAgentId = agentId;
  let runId;

  if (!activeAgentId) {
    let knowledgePack = "";
    if (mode === "public") {
      try {
        knowledgePack = await buildPublicKnowledgePack();
      } catch (error) {
        console.warn("Chat assistant knowledge pack failed:", error.message);
      }
    }

    const systemPrompt = buildAssistantSystemPrompt(user, mode, knowledgePack);
    // Omit repos on purpose: public FAQ does not need a GitHub workspace.
    // Knowledge is injected in the prompt so the agent can answer accurately.
    const { data } = await client.post("/v1/agents", {
      name: mode === "public" ? "IGITI Public" : "IGITI MIS",
      prompt: {
        text: `${systemPrompt}\n\nVisitor / user question: ${trimmed}`,
      },
      model: { id: model },
    });

    activeAgentId = data.agent?.id;
    runId = data.run?.id;
  } else {
    const { data } = await client.post(`/v1/agents/${activeAgentId}/runs`, {
      prompt: { text: buildFollowUpPrompt(trimmed, mode) },
    });
    runId = data.run?.id;
  }

  if (!activeAgentId || !runId) {
    throw new Error("Unexpected response from assistant service");
  }

  const result = await waitForRun(client, activeAgentId, runId);

  return {
    reply: mode === "public" ? sanitizeAssistantReply(result.reply) : result.reply,
    agentId: activeAgentId,
    runId: result.runId,
  };
}

export async function resetChatSession(agentId) {
  if (!agentId) return;

  try {
    const client = cursorClient();
    await client.post(`/v1/agents/${agentId}/archive`);
  } catch (error) {
    // Best-effort cleanup; ignore archive failures.
    console.warn("Chat assistant archive failed:", error.message);
  }
}
