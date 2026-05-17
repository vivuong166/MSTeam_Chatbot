import { pool } from "../db/index";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export async function getHistory(userId: string): Promise<Message[]> {
  try {
    const res = await pool.query(
      `SELECT role, content
       FROM messages
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    // đảo lại để đúng thứ tự hội thoại
    return res.rows.reverse();

  } catch (err) {
    console.error("❌ DB getHistory error:", err);
    return [];
  }
}

export async function addMessage(
  userId: string,
  role: "user" | "assistant",
  content: string
) {
  try {
    await pool.query(
      `INSERT INTO messages (user_id, role, content)
       VALUES ($1, $2, $3)`,
      [userId, role, content]
    );
  } catch (err) {
    console.error("❌ DB addMessage error:", err);
  }
}