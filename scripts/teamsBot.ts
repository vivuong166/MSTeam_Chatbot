import { env } from "../src/config/env";
import { AgentApiClient, AgentApiError } from "../src/teams/agentApiClient";
import { TeamsWebAdapter } from "../src/teams/teamsWebAdapter";
import { LatestTextDeduplicator } from "../src/utils/latestTextDeduplicator";
import { logger } from "../src/utils/logger";
import { Builder } from "selenium-webdriver";

const POLL_INTERVAL_MS = 2_000;
const REPLY_WAIT_MS = 4_000;
const LOGIN_WAIT_MS = 30_000;
const BOT_REPLY_MEMORY_MS = 120_000;

function consumeBotReply(
  expectedReplies: Map<string, number>,
  text: string
): boolean {
  const sentAt = expectedReplies.get(text);
  if (!sentAt) {
    return false;
  }

  expectedReplies.delete(text);
  return Date.now() - sentAt <= BOT_REPLY_MEMORY_MS;
}

async function startBot() {
  logger.info("Teams Selenium bot started");

  const driver = await new Builder().forBrowser("chrome").build();
  const teams = new TeamsWebAdapter(driver);
  const agentApi = new AgentApiClient(
    env.agentApi.baseUrl,
    env.agentApi.timeoutMs
  );
  const deduplicator = new LatestTextDeduplicator();
  const expectedBotReplies = new Map<string, number>();
  let activeConversationUserKey = "manual_operator";

  try {
    await driver.get("https://teams.microsoft.com");
    const teamsTabHandle = await driver.getWindowHandle();
    await driver.manage().window().setRect({
      x: 0,
      y: 0,
      width: env.teams.windowWidth,
      height: env.teams.windowHeight
    });

    try {
      await driver.switchTo().newWindow("tab");
      await driver.get(env.controlPanel.url);
      await driver.switchTo().window(teamsTabHandle);
      logger.info(`Control panel tab opened at ${env.controlPanel.url}`);
    } catch (error) {
      await driver.switchTo().window(teamsTabHandle);
      logger.error("Unable to open the control panel tab", error);
    }

    logger.info("Login and open the target chat within 30 seconds");
    await driver.sleep(LOGIN_WAIT_MS);

    logger.info("Teams bot is running");

    while (true) {
      try {
        const message = await teams.getLatestMessage();

        if (!message) {
          await driver.sleep(POLL_INTERVAL_MS);
          continue;
        }

        const deduplicationKey = message.messageId || `${message.direction}:${message.senderId}:${message.text}`;
        if (deduplicator.isDuplicate(deduplicationKey)) {
          await driver.sleep(POLL_INTERVAL_MS);
          continue;
        }

        if (message.direction === "self") {
          if (consumeBotReply(expectedBotReplies, message.text)) {
            await driver.sleep(POLL_INTERVAL_MS);
            continue;
          }

          const control = await agentApi.getBotControlStatus();
          if (!control.autoReply) {
            await agentApi.recordManualTranscript({
              userKey: activeConversationUserKey,
              role: "assistant",
              messageId: message.messageId,
              text: message.text
            });
            logger.info("Manual Teams reply recorded");
          }

          await driver.sleep(POLL_INTERVAL_MS);
          continue;
        }

        activeConversationUserKey = message.senderId;
        const control = await agentApi.getBotControlStatus();
        if (!control.autoReply) {
          await agentApi.recordManualTranscript({
            userKey: message.senderId,
            role: "user",
            messageId: message.messageId,
            text: message.text
          });
          logger.info(`Manual-mode Teams message recorded from ${message.senderId}`);
          await driver.sleep(POLL_INTERVAL_MS);
          continue;
        }

        logger.info(`Processing Teams message from ${message.senderId}`);
        let reply: string;

        try {
          const agentReply = await agentApi.reply({
            source: "teams",
            userKey: message.senderId,
            messageId: message.messageId,
            text: message.text
          });
          reply = agentReply.reply;
          logger.info(`Agent API reply received requestId=${agentReply.requestId}`);
        } catch (error) {
          const requestId = error instanceof AgentApiError && error.requestId
            ? ` requestId=${error.requestId}`
            : "";
          logger.error(`Agent API request failed${requestId}`, error);
          reply = "Hệ thống đang gặp sự cố, bạn vui lòng thử lại sau ít phút.";
        }

        const latestControl = await agentApi.getBotControlStatus();
        if (latestControl.autoReply) {
          expectedBotReplies.set(reply, Date.now());
          await teams.sendReply(reply);
          logger.info("Teams reply sent");
        } else {
          logger.info("Bot was paused before the reply could be sent");
        }

        await driver.sleep(REPLY_WAIT_MS);
      } catch (error) {
        logger.error("Teams bot loop failed", error);
        await driver.sleep(POLL_INTERVAL_MS);
      }
    }

  } catch (error) {
    logger.error("Teams bot failed to start", error);
  }
}

startBot();
