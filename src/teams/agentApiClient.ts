import type { AiReplySource } from "../domain/aiReply";

type AgentApiSuccessBody = {
  reply?: unknown;
  requestId?: unknown;
};

type AgentApiErrorBody = {
  error?: {
    code?: unknown;
  };
  requestId?: unknown;
};

export type AgentReplyInput = {
  source: AiReplySource;
  userKey: string;
  messageId: string | null;
  text: string;
};

export type AgentReply = {
  reply: string;
  requestId: string;
};

export type BotControlStatus = {
  botInstanceId: string;
  autoReply: boolean;
  mode: "automatic" | "manual";
  updatedAt: string;
};

export type ManualTranscriptInput = {
  userKey: string;
  role: "user" | "assistant";
  messageId: string | null;
  text: string;
};

export class AgentApiError extends Error {
  constructor(message: string, public readonly requestId?: string) {
    super(message);
    this.name = "AgentApiError";
  }
}

function getRequestId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const requestId = (data as AgentApiSuccessBody | AgentApiErrorBody).requestId;
  return typeof requestId === "string" ? requestId : undefined;
}

export class AgentApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number
  ) {}

  async reply(input: AgentReplyInput): Promise<AgentReply> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/ai/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: input.source,
          userKey: input.userKey,
          ...(input.messageId ? { messageId: input.messageId } : {}),
          text: input.text
        }),
        signal: abortController.signal
      });

      const data: unknown = await response.json().catch(() => undefined);
      const requestId = getRequestId(data);

      if (!response.ok) {
        const errorCode =
          data &&
          typeof data === "object" &&
          typeof (data as AgentApiErrorBody).error?.code === "string"
            ? (data as AgentApiErrorBody).error?.code
            : "UNKNOWN_ERROR";

        throw new AgentApiError(
          `Agent API returned HTTP ${response.status} (${errorCode})`,
          requestId
        );
      }

      const success = data as AgentApiSuccessBody | undefined;
      if (typeof success?.reply !== "string" || typeof success.requestId !== "string") {
        throw new AgentApiError("Agent API returned an invalid response", requestId);
      }

      return { reply: success.reply, requestId: success.requestId };
    } catch (error) {
      if (error instanceof AgentApiError) {
        throw error;
      }

      const message = error instanceof Error && error.name === "AbortError"
        ? "Agent API request timed out"
        : "Unable to reach Agent API";
      throw new AgentApiError(message);
    } finally {
      clearTimeout(timeout);
    }
  }

  async getBotControlStatus(): Promise<BotControlStatus> {
    const response = await this.request("/bot-control/status", "GET");
    const data = response.data;

    if (
      !data ||
      typeof data !== "object" ||
      typeof (data as BotControlStatus).botInstanceId !== "string" ||
      typeof (data as BotControlStatus).autoReply !== "boolean" ||
      ((data as BotControlStatus).mode !== "automatic" && (data as BotControlStatus).mode !== "manual") ||
      typeof (data as BotControlStatus).updatedAt !== "string"
    ) {
      throw new AgentApiError("Bot control API returned an invalid response", response.requestId);
    }

    return data as BotControlStatus;
  }

  async recordManualTranscript(input: ManualTranscriptInput): Promise<void> {
    await this.request("/bot-control/transcript", "POST", {
      userKey: input.userKey,
      role: input.role,
      ...(input.messageId ? { messageId: input.messageId } : {}),
      text: input.text
    });
  }

  private async request(path: string, method: "GET" | "POST", body?: object): Promise<{ data: unknown; requestId?: string }> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: abortController.signal
      });
      const data: unknown = await response.json().catch(() => undefined);
      const requestId = getRequestId(data);

      if (!response.ok) {
        throw new AgentApiError(`Bot control API returned HTTP ${response.status}`, requestId);
      }

      return { data, requestId };
    } catch (error) {
      if (error instanceof AgentApiError) {
        throw error;
      }

      const message = error instanceof Error && error.name === "AbortError"
        ? "Bot control API request timed out"
        : "Unable to reach Bot control API";
      throw new AgentApiError(message);
    } finally {
      clearTimeout(timeout);
    }
  }
}
