import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  user: "postgres",
  host: "127.0.0.1",
  database: "chatbot",
  password: process.env.DB_PASSWORD,
  port: 8888
});
// test connection (debug cực hữu ích)
pool.connect()
  .then(() => console.log("✅ PostgreSQL connected"))
  .catch(err => console.error("❌ PostgreSQL error:", err));