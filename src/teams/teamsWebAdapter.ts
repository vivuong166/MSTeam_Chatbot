import { By, Key, type WebDriver } from "selenium-webdriver";

export type TeamsMessage = {
  messageId: string | null;
  senderId: string;
  text: string;
  direction: "external" | "self";
};

export class TeamsWebAdapter {
  constructor(private readonly driver: WebDriver) {}

  async getLatestMessage(): Promise<TeamsMessage | null> {
    const messages = await this.driver.findElements(
      By.css('div[data-tid="chat-pane-message"]')
    );

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      const className = (await message.getAttribute("class")) || "";

      const content = await message.findElement(By.css("[data-message-content]"));
      const text = (await content.getText()).trim();
      if (!text) {
        continue;
      }

      const messageId = await message.getAttribute("data-mid");
      const direction = className.includes("ChatMyMessage") ? "self" : "external";
      const senderId = direction === "self" ? "manual_operator" : await this.getSenderId(messageId);

      return { messageId, senderId, text, direction };
    }

    return null;
  }

  async getLatestExternalMessage(): Promise<TeamsMessage | null> {
    const message = await this.getLatestMessage();
    return message?.direction === "external" ? message : null;
  }

  async sendReply(reply: string): Promise<void> {
    const inputBox = await this.driver.findElement(
      By.css('[contenteditable="true"]')
    );

    await inputBox.click();
    await inputBox.sendKeys(Key.CONTROL, "a");
    await inputBox.sendKeys(Key.DELETE);
    await inputBox.sendKeys(reply);
    await inputBox.sendKeys(Key.RETURN);
  }

  private async getSenderId(messageId: string | null): Promise<string> {
    if (!messageId) {
      return "unknown_user";
    }

    try {
      const author = await this.driver.findElement(By.id(`author-${messageId}`));
      return (await author.getText()).trim() || "unknown_user";
    } catch {
      return "unknown_user";
    }
  }
}
