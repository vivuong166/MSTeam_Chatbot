import dotenv from "dotenv";

dotenv.config();

function readPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
    ? parsed
    : fallback;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

const agentApiBaseUrl = (process.env.AGENT_API_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

export const env = {
  port: readPort(process.env.PORT, 3000),
  database: {
    connectionString: process.env.DATABASE_URL,
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "127.0.0.1",
    name: process.env.DB_NAME || "chatbot",
    password: process.env.DB_PASSWORD,
    port: readPort(process.env.DB_PORT, 8888)
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash"
  },
  toolhub: {
    baseUrl: (process.env.TOOLHUB_BASE_URL || "https://api.toolhub.app").replace(/\/+$/, ""),
    timeoutMs: readPositiveInteger(process.env.TOOLHUB_TIMEOUT_MS, 8_000),
    retryCount: readNonNegativeInteger(process.env.TOOLHUB_RETRY_COUNT, 1)
  },
  agentApi: {
    baseUrl: agentApiBaseUrl,
    timeoutMs: readPositiveInteger(process.env.AGENT_API_TIMEOUT_MS, 30_000)
  },
  teams: {
    autoReply: process.env.TEAMS_AUTO_REPLY !== "false",
    windowWidth: readPositiveInteger(process.env.TEAMS_WINDOW_WIDTH, 960),
    windowHeight: readPositiveInteger(process.env.TEAMS_WINDOW_HEIGHT, 900)
  },
  controlPanel: {
    url: process.env.CONTROL_PANEL_URL || `${agentApiBaseUrl}/sidebar/`
  },
  bot: {
    instanceId: process.env.BOT_INSTANCE_ID || "teams-local"
  }
} as const;
