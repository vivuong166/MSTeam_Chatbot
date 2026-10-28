import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { chatService } from "../agent/chatService";
import type {
  AiReplyRequest,
  AiReplyResponse,
  ApiErrorResponse,
  AiReplySource
} from "../domain/aiReply";
import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";

const MAX_TEXT_LENGTH = 4_000;
const MAX_IDENTIFIER_LENGTH = 512;
const VALID_SOURCES = new Set<AiReplySource>(["teams", "api"]);

type RequestBody = Partial<AiReplyRequest>;

function requireText(
  value: unknown,
  fieldName: string,
  maximumLength: number
): string {
  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_REQUEST", `Trường ${fieldName} là bắt buộc`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new AppError(400, "INVALID_REQUEST", `Trường ${fieldName} không được để trống`);
  }

  if (normalized.length > maximumLength) {
    throw new AppError(
      400,
      "INVALID_REQUEST",
      `Trường ${fieldName} vượt quá ${maximumLength} ký tự`
    );
  }

  return normalized;
}

function parseRequest(body: RequestBody | undefined): AiReplyRequest {
  const source = requireText(body?.source, "source", 32);
  if (!VALID_SOURCES.has(source as AiReplySource)) {
    throw new AppError(400, "INVALID_REQUEST", "source phải là teams hoặc api");
  }

  const messageId = body?.messageId;
  if (messageId !== undefined && typeof messageId !== "string") {
    throw new AppError(400, "INVALID_REQUEST", "messageId phải là chuỗi nếu được cung cấp");
  }

  return {
    source: source as AiReplySource,
    userKey: requireText(body?.userKey, "userKey", MAX_IDENTIFIER_LENGTH),
    ...(messageId === undefined
      ? {}
      : { messageId: requireText(messageId, "messageId", MAX_IDENTIFIER_LENGTH) }),
    text: requireText(body?.text, "text", MAX_TEXT_LENGTH)
  };
}

export async function handleAiReply(
  req: Request<Record<string, never>, AiReplyResponse | ApiErrorResponse, RequestBody>,
  res: Response<AiReplyResponse | ApiErrorResponse>,
  next: NextFunction
): Promise<void> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  res.locals.requestId = requestId;

  try {
    const input = parseRequest(req.body);
    logger.info(
      `AI reply received requestId=${requestId} source=${input.source} ` +
        `hasMessageId=${Boolean(input.messageId)} textLength=${input.text.length}`
    );

    const agentReply = await chatService.reply({
      userId: input.userKey,
      message: input.text
    });

    logger.info(
      `AI reply completed requestId=${requestId} intent=${agentReply.intent} ` +
        `toolUsed=${agentReply.toolUsed} latencyMs=${Date.now() - startedAt}`
    );
    res.status(200).json({ ...agentReply, requestId });
  } catch (error) {
    next(error);
  }
}
