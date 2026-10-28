import { randomUUID } from "crypto";
import type { ErrorRequestHandler } from "express";
import type { ApiErrorResponse } from "../domain/aiReply";
import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";

function isMalformedJsonError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "type" in error &&
    (error as { status?: unknown }).status === 400 &&
    (error as { type?: unknown }).type === "entity.parse.failed"
  );
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId =
    typeof res.locals.requestId === "string" ? res.locals.requestId : randomUUID();
  const appError = error instanceof AppError ? error : null;
  const malformedJson = isMalformedJsonError(error);
  const status = appError?.status ?? (malformedJson ? 400 : 500);
  const code = appError?.code ?? (malformedJson ? "INVALID_JSON" : "INTERNAL_ERROR");
  const message = appError?.message ?? (malformedJson ? "Body JSON không hợp lệ" : "Lỗi nội bộ máy chủ");

  logger.error(`AI reply failed requestId=${requestId} code=${code}`, error);

  const body: ApiErrorResponse = {
    error: { code, message },
    requestId
  };

  res.status(status).json(body);
};
