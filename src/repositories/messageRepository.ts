import { pool } from "../db/pool";
import type { ChatMessage, ChatRole } from "../domain/chat";
import { logger } from "../utils/logger";

const HISTORY_LIMIT = 10;

export class MessageRepository {
  async getRecent(userId: string): Promise<ChatMessage[]> {
    try {
      const result = await pool.query<ChatMessage>(
        `SELECT role, content
         FROM messages
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, HISTORY_LIMIT]
      );

      return result.rows.reverse();
    } catch (error) {
      logger.error("Unable to load chat history", error);
      return [];
    }
  }

  async add(userId: string, role: ChatRole, content: string): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO messages (user_id, role, content)
         VALUES ($1, $2, $3)`,
        [userId, role, content]
      );
    } catch (error) {
      logger.error("Unable to persist chat message", error);
    }
  }
}

export const messageRepository = new MessageRepository();
