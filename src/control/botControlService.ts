import { env } from "../config/env";
import {
  botControlRepository,
  type StoredBotControlState
} from "../repositories/botControlRepository";
import { logger } from "../utils/logger";

export type BotControlStatus = {
  botInstanceId: string;
  autoReply: boolean;
  mode: "automatic" | "manual";
  updatedAt: string;
};

export type BotControlStore = {
  get(botInstanceId: string): Promise<StoredBotControlState | null>;
  save(botInstanceId: string, autoReply: boolean): Promise<StoredBotControlState>;
};

export class BotControlService {
  private autoReply: boolean;
  private updatedAt: Date;
  private persistenceAvailable = true;

  constructor(
    initialAutoReply: boolean,
    private readonly store: BotControlStore = botControlRepository,
    private readonly botInstanceId = env.bot.instanceId
  ) {
    this.autoReply = initialAutoReply;
    this.updatedAt = new Date();
  }

  async getStatus(): Promise<BotControlStatus> {
    if (this.persistenceAvailable) {
      try {
        const stored = await this.store.get(this.botInstanceId);
        if (stored) {
          this.autoReply = stored.autoReply;
          this.updatedAt = new Date(stored.updatedAt);
          return this.toStatus();
        }

        const saved = await this.store.save(this.botInstanceId, this.autoReply);
        this.updatedAt = new Date(saved.updatedAt);
      } catch (error) {
        this.disablePersistence(error);
      }
    }

    return this.toStatus();
  }

  async setAutoReply(autoReply: boolean): Promise<BotControlStatus> {
    this.autoReply = autoReply;
    this.updatedAt = new Date();

    if (this.persistenceAvailable) {
      try {
        const saved = await this.store.save(this.botInstanceId, autoReply);
        this.updatedAt = new Date(saved.updatedAt);
      } catch (error) {
        this.disablePersistence(error);
      }
    }

    return this.toStatus();
  }

  private toStatus(): BotControlStatus {
    return {
      botInstanceId: this.botInstanceId,
      autoReply: this.autoReply,
      mode: this.autoReply ? "automatic" : "manual",
      updatedAt: this.updatedAt.toISOString()
    };
  }

  private disablePersistence(error: unknown): void {
    if (this.persistenceAvailable) {
      logger.warn("Bot control is using memory because the database migration is unavailable");
      logger.error("Bot control database access failed", error);
    }
    this.persistenceAvailable = false;
  }
}

export const botControlService = new BotControlService(env.teams.autoReply);
