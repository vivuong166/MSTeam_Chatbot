import { Builder, By, Key } from "selenium-webdriver";
import dotenv from "dotenv";
dotenv.config();
import { getAIResponse } from "../src/services/openai";


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
          By.css('div[data-tid="chat-pane-message"]') // 👉 giữ nguyên cái đang chạy OK
        );

        if (messages.length === 0) {
          await driver.sleep(2000);
          continue;
        }

        let text: string | null = null;

        // 🔥 giữ nguyên logic của bạn (ổn định nhất rồi)
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];

          const className = await msg.getAttribute("class");

          // ❗ bỏ tin của mình
          if (className.includes("ChatMyMessage")) continue;

          const content = await msg.findElement(
            By.css("[data-message-content]")
          );

          const t = (await content.getText()).trim();

          if (!t) continue;

          text = t;
          break;
        }

        if (!text) {
          console.log("⚠️ Không có tin người khác");
          await driver.sleep(2000);
          continue;
        }

        console.log("📩 Người khác:", text);

        // ❗ tránh duplicate
        if (text === lastMessage) {
          await driver.sleep(2000);
          continue;
        }

        lastMessage = text;

        

        // 🔥 dùng service chung (quan trọng)
        const senderElement = await driver.findElement(   //message cũng ok
          By.css('[data-tid="message-author-name"]')
        );

        const senderName = await senderElement.getText();

        console.log("👤 Sender:", senderName);
        console.log("📩 Message:", text);

        const reply = await getAIResponse(senderName, text);

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