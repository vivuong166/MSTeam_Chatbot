import { readFile } from "fs/promises";
import path from "path";
import { pool } from "../src/db/pool";

async function main(): Promise<void> {
  const migrationPath = path.resolve(
    process.cwd(),
    "src/db/migrations/001_bot_control_state.sql"
  );
  const sql = await readFile(migrationPath, "utf8");

  await pool.query(sql);
  console.log("Bot-control migration completed");
}

void main()
  .catch((error) => {
    console.error("Bot-control migration failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
