import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

export function startServer(): void {
  app.listen(env.port, () => {
    logger.info(`Server running on port ${env.port}`);
  });
}
