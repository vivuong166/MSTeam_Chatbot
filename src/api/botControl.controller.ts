import type { NextFunction, Request, Response } from "express";
import { botControlService, type BotControlStatus } from "../control/botControlService";
import { messageRepository } from "../repositories/messageRepository";
import type { ChatRole } from "../domain/chat";
import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";

const MAX_TEXT_LENGTH = 4_000;
const MAX_IDENTIFIER_LENGTH = 512;

type StatusBody = { autoReply?: unknown };
type TranscriptBody = {
  userKey?: unknown;
  role?: unknown;
  text?: unknown;
  messageId?: unknown;
};

function requireText(value: unknown, fieldName: string, maximumLength: number): string {
  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_REQUEST", `Trường ${fieldName} là bắt buộc`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new AppError(400, "INVALID_REQUEST", `Trường ${fieldName} không được để trống`);
  }

  if (normalized.length > maximumLength) {
    throw new AppError(400, "INVALID_REQUEST", `Trường ${fieldName} vượt quá ${maximumLength} ký tự`);
  }

  return normalized;
}

export async function getBotControlStatus(
  _req: Request,
  res: Response<BotControlStatus>,
  next: NextFunction
): Promise<void> {
  try {
    res.json(await botControlService.getStatus());
  } catch (error) {
    next(error);
  }
}

export async function updateBotControlStatus(
  req: Request<Record<string, never>, BotControlStatus, StatusBody>,
  res: Response<BotControlStatus>,
  next: NextFunction
): Promise<void> {
  try {
    if (typeof req.body?.autoReply !== "boolean") {
      throw new AppError(400, "INVALID_REQUEST", "Trường autoReply phải là boolean");
    }

    const status = await botControlService.setAutoReply(req.body.autoReply);
    logger.info(`Bot control updated mode=${status.mode}`);
    res.json(status);
  } catch (error) {
    next(error);
  }
}

export async function recordManualTranscript(
  req: Request<Record<string, never>, { recorded: true }, TranscriptBody>,
  res: Response<{ recorded: true }>,
  next: NextFunction
): Promise<void> {
  try {
    const userKey = requireText(req.body?.userKey, "userKey", MAX_IDENTIFIER_LENGTH);
    const text = requireText(req.body?.text, "text", MAX_TEXT_LENGTH);
    const role = req.body?.role;

    if (role !== "user" && role !== "assistant") {
      throw new AppError(400, "INVALID_REQUEST", "role phải là user hoặc assistant");
    }

    if (req.body?.messageId !== undefined && typeof req.body.messageId !== "string") {
      throw new AppError(400, "INVALID_REQUEST", "messageId phải là chuỗi nếu được cung cấp");
    }

    await messageRepository.add(userKey, role as ChatRole, text);
    logger.info(`Manual Teams message recorded role=${role} textLength=${text.length}`);
    res.status(201).json({ recorded: true });
  } catch (error) {
    next(error);
  }
}
