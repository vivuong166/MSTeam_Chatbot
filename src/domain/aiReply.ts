import type { AgentIntent, AgentTool } from "./agent";

export type AiReplySource = "teams" | "api";

export type AiReplyRequest = {
  source: AiReplySource;
  userKey: string;
  messageId?: string;
  text: string;
};

export type AiReplyResponse = {
  reply: string;
  requestId: string;
  intent: AgentIntent;
  toolUsed: AgentTool;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
  requestId: string;
};
