export class LatestTextDeduplicator {
  private latestText: string | null = null;

  isDuplicate(text: string): boolean {
    if (text === this.latestText) {
      return true;
    }

    this.latestText = text;
    return false;
  }
}
