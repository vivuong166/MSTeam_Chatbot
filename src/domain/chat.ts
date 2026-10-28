export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatRequest = {
  userId: string;
  message: string;
};

export type ChatResponse = {
  reply: string;
};
