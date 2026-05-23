// src/bot/handler.ts
import { getAIResponse } from "../services/openAI";

export async function handleChat(req: any, res: any) {
  const { message, userId } = req.body; // ← thêm userId

  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  const reply = await getAIResponse(userId, message); // ← không hardcode nữa
  res.json({ reply });
}