import { env } from "../config/env";
import type { ChatMessage } from "../domain/chat";
import { logger } from "../utils/logger";
import { cleanTextForTeams } from "../utils/text";

type GeminiApiResponse = {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
  error?: {
    message?: string;
  };
  promptFeedback?: {
    blockReason?: string;
  };
};

export type GenerationResult =
  | { ok: true; reply: string }
  | {
      ok: false;
      reply: string;
      code: "SERVICE_NOT_CONFIGURED" | "MODEL_UNAVAILABLE";
    };

const SYSTEM_INSTRUCTION =
  "Bạn là trợ lý tư vấn học phần HUST trên Microsoft Teams. " +
  "Với câu hỏi học phần, chỉ dùng dữ liệu ToolHub được cung cấp trong ngữ cảnh; " +
  "nếu dữ liệu thiếu hoặc mơ hồ, nói rõ và không bịa. " +
  "Trả lời bằng tiếng Việt, ngắn gọn, dễ đọc và không dùng emoji. " +
  "Không yêu cầu hoặc xử lý mật khẩu HUST/SIS.";

export class GeminiClient {
  async generate(history: ChatMessage[], message: string): Promise<GenerationResult> {
    if (!env.gemini.apiKey) {
      logger.error("GEMINI_API_KEY is not configured");
      return {
        ok: false,
        reply: "Chưa cấu hình Gemini API key",
        code: "SERVICE_NOT_CONFIGURED"
      };
    }

    const contents = [
      ...history
        .filter((item) => item.content && typeof item.content === "string")
        .map((item) => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content }]
        })),
      { role: "user", parts: [{ text: message }] }
    ];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.gemini.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": env.gemini.apiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents
          })
        }
      );

      const data = (await response.json()) as GeminiApiResponse;
      if (!response.ok) {
        logger.error("Gemini API request failed", data.error?.message);
        return {
          ok: false,
          reply: "Gemini đang gặp lỗi, vui lòng thử lại",
          code: "MODEL_UNAVAILABLE"
        };
      }

      const reply = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("");

      if (!reply) {
        logger.warn("Gemini returned no text");
        return {
          ok: false,
          reply: data.promptFeedback?.blockReason
            ? "Nội dung này không thể được xử lý"
            : "Gemini không có phản hồi",
          code: "MODEL_UNAVAILABLE"
        };
      }

      return { ok: true, reply: cleanTextForTeams(reply) };
    } catch (error) {
      logger.error("Gemini request failed", error);
      return {
        ok: false,
        reply: "Lỗi kết nối Gemini",
        code: "MODEL_UNAVAILABLE"
      };
    }
  }
}

export const geminiClient = new GeminiClient();
