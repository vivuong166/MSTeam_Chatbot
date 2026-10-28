import { Pool } from "pg";
import { env } from "../config/env";

export const pool = env.database.connectionString
  ? new Pool({ connectionString: env.database.connectionString })
  : new Pool({
      user: env.database.user,
      host: env.database.host,
      database: env.database.name,
      password: env.database.password,
      port: env.database.port
    });

export async function checkDatabaseConnection(): Promise<void> {
  await pool.query("SELECT 1");
}
