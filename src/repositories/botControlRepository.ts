import { pool } from "../db/pool";

export type StoredBotControlState = {
  autoReply: boolean;
  updatedAt: string;
};

type BotControlRow = {
  autoReply: boolean;
  updatedAt: Date;
};

function toStoredState(row: BotControlRow): StoredBotControlState {
  return {
    autoReply: row.autoReply,
    updatedAt: row.updatedAt.toISOString()
  };
}

export class BotControlRepository {
  async get(botInstanceId: string): Promise<StoredBotControlState | null> {
    const result = await pool.query<BotControlRow>(
      `SELECT auto_reply AS "autoReply", updated_at AS "updatedAt"
       FROM bot_control_state
       WHERE bot_instance_id = $1`,
      [botInstanceId]
    );

    return result.rows[0] ? toStoredState(result.rows[0]) : null;
  }

  async save(botInstanceId: string, autoReply: boolean): Promise<StoredBotControlState> {
    const result = await pool.query<BotControlRow>(
      `INSERT INTO bot_control_state (bot_instance_id, auto_reply)
       VALUES ($1, $2)
       ON CONFLICT (bot_instance_id)
       DO UPDATE SET auto_reply = EXCLUDED.auto_reply, updated_at = NOW()
       RETURNING auto_reply AS "autoReply", updated_at AS "updatedAt"`,
      [botInstanceId, autoReply]
    );

    return toStoredState(result.rows[0]);
  }
}

export const botControlRepository = new BotControlRepository();
