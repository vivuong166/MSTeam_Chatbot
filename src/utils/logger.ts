function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const logger = {
  info(message: string): void {
    console.log(`[INFO] ${message}`);
  },
  warn(message: string): void {
    console.warn(`[WARN] ${message}`);
  },
  error(message: string, error?: unknown): void {
    console.error(
      `[ERROR] ${message}${error === undefined ? "" : `: ${errorMessage(error)}`}`
    );
  }
};
