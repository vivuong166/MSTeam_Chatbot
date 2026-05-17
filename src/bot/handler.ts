import { getAIResponse } from "../services/openai";

export async function handleChat(req: any, res: any) {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ error: "Missing message" });
  }

const reply = await getAIResponse("default_user", userMessage);
  res.json({ reply });
}