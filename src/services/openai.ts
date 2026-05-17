import { getHistory, addMessage } from "../memory/dbMemory";

type AIResponse = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
};

function cleanText(text: string) {
  return text
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "") // remove emoji (fix Selenium)
    .replace(/\n/g, " ");
}

export async function getAIResponse(userId: string, message: string) {
  // 🚨 tránh undefined/null
  if (!message || typeof message !== "string") {
    console.log("⚠️ Invalid message:", message);
    return "Tin nhắn không hợp lệ";
  }

  const history = await getHistory(userId);

  // 🚨 lọc content null (fix lỗi 400)
  const safeHistory = history.filter(
    (msg: any) => msg.content && typeof msg.content === "string"
  );

  const messages = [
    {
      role: "system",
      content: "Bạn là sinh viên IT, trả lời ngắn gọn, có emoji."
    },
    ...safeHistory,
    { role: "user", content: message }
  ];

  

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini", // 🔥 model ổn định
        messages
      })
    });

    const data = (await res.json()) as AIResponse;

    if (!res.ok) {
      console.log("❌ API ERROR:", JSON.stringify(data));
      return "AI lỗi 😢";
    }

    let reply =
      data.choices?.[0]?.message?.content || "Không có phản hồi";

    reply = cleanText(reply);

    // 💾 lưu DB
    await addMessage(userId, "user", message);
    await addMessage(userId, "assistant", reply);

    return reply;

  } catch (err: any) {
    console.log("❌ Fetch error:", err.message);
    return "Lỗi server 😢";
  }
}