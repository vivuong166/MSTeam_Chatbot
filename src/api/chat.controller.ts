import type { Request, Response } from "express";
import { chatService } from "../agent/chatService";
import type { ChatRequest, ChatResponse } from "../domain/chat";

type RequestBody = Partial<ChatRequest>;

export async function handleChat(
  req: Request<Record<string, never>, ChatResponse | { error: string }, RequestBody>,
  res: Response<ChatResponse | { error: string }>
): Promise<void> {
  const { message, userId } = req.body || {};

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Missing message" });
    return;
  }

  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  const agentReply = await chatService.reply({ userId, message });
  res.json({ reply: agentReply.reply });
}
