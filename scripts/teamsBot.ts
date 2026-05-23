import { Builder, By, Key } from "selenium-webdriver";
import dotenv from "dotenv";
dotenv.config();
import { getAIResponse } from "../src/services/openAI";

let lastMessage: string | null = null;

async function startBot() {
  console.log("🚀 Teams Selenium bot started");

  const driver = await new Builder().forBrowser("chrome").build();

  try {
    await driver.get("https://teams.microsoft.com");

    console.log("👉 Login + mở chat trong 30s...");
    await driver.sleep(30000);

    console.log("✅ Running...");

    while (true) {
      try {
        const messages = await driver.findElements(
          By.css('div[data-tid="chat-pane-message"]')
        );

        if (messages.length === 0) {
          await driver.sleep(2000);
          continue;
        }

        let text: string | null = null;
        let senderId: string | null = null;

        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          const className = await msg.getAttribute("class");

          // ❗ bỏ tin của mình
          if (className.includes("ChatMyMessage")) continue;

          const content = await msg.findElement(By.css("[data-message-content]"));
          const t = (await content.getText()).trim();
          if (!t) continue;

          // ✅ lấy data-mid → tìm author-{mid} trên toàn trang
          const mid = await msg.getAttribute("data-mid");
          try {
            const authorEl = await driver.findElement(By.id(`author-${mid}`));
            senderId = (await authorEl.getText()).trim() || "unknown_user";
          } catch {
            senderId = "unknown_user";
          }

          text = t;
          break;
        }

        if (!text) {
          console.log("⚠️ Không có tin người khác");
          await driver.sleep(2000);
          continue;
        }

        // ❗ tránh duplicate
        if (text === lastMessage) {
          await driver.sleep(2000);
          continue;
        }

        lastMessage = text;

        console.log("👤 Sender ID:", senderId);
        console.log("📩 Message:", text);

        const reply = await getAIResponse(senderId ?? "unknown_user", text);

        const inputBox = await driver.findElement(
          By.css('[contenteditable="true"]')
        );

        await inputBox.click();
        await inputBox.sendKeys(Key.CONTROL, "a");
        await inputBox.sendKeys(Key.DELETE);
        await inputBox.sendKeys(reply);
        await inputBox.sendKeys(Key.RETURN);

        console.log("🤖 Đã reply:", reply);

        await driver.sleep(4000);

      } catch (err: any) {
        console.log("⚠️ Loop error:", err.message);
        await driver.sleep(2000);
      }
    }

  } catch (err) {
    console.error("❌ Bot error:", err);
  }
}

startBot();