export function cleanTextForTeams(text: string): string {
  return text
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "")
    .replace(/\n/g, " ");
}
