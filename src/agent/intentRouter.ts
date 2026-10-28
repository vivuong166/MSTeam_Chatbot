import type { AgentIntent } from "../domain/agent";

const COURSE_CODE_PATTERN = /\b[A-Za-z]{2,10}\d{3,6}[A-Za-z]?\b/g;
const TREE_TERMS = /\b(ve|cay|so do|dependency)\b/i;
const DEPENDENCY_TERMS = /ph[ụu]\s*thu[ộo]c|đi[ềe]u\s*ki[ệe]n|ti[eê]n\s*quy[ếe]t|h[oọ]c\s*tr[uư][oớ]c|dependency/i;
const GROUP_TERMS = /\b(nh[oó]m|nhi[ềe]u|c[aá]c)\s+(m[oô]n|m[aã])/i;
const COURSE_TERMS = /h[oọ]c\s*ph[ầa]n|m[oô]n\s*h[oọ]c|t[ií]n\s*ch[iỉ]|đi[ềe]u\s*ki[ệe]n|ti[eê]n\s*quy[ếe]t|n[oộ]i\s*dung|m[ụu]c\s*ti[eê]u/i;
const COURSE_DESCRIPTION_TERMS = /\bh[oọ]c\s+g[iì]\b/i;

export type IntentRoute = {
  intent: AgentIntent;
  courseCodes: string[];
  searchQuery: string | null;
};

function normalizeForIntent(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN");
}

function extractCourseCodes(text: string): string[] {
  const matches = text.match(COURSE_CODE_PATTERN) || [];
  return [...new Set(matches.map((code) => code.toUpperCase()))];
}

export class IntentRouter {
  route(text: string): IntentRoute {
    const normalized = normalizeForIntent(text);
    const courseCodes = extractCourseCodes(text);
    const asksForTree = TREE_TERMS.test(normalized) && DEPENDENCY_TERMS.test(normalized);

    if (asksForTree) {
      return {
        intent: courseCodes.length > 1 || GROUP_TERMS.test(normalized)
          ? "course_group_tree"
          : "course_dependency_tree",
        courseCodes,
        searchQuery: null
      };
    }

    if (
      courseCodes.length > 0 ||
      COURSE_TERMS.test(normalized) ||
      COURSE_DESCRIPTION_TERMS.test(normalized)
    ) {
      return {
        intent: "course_search",
        courseCodes,
        searchQuery: courseCodes.length === 1 ? courseCodes[0] : text.trim()
      };
    }

    return { intent: "general", courseCodes: [], searchQuery: null };
  }
}

export const intentRouter = new IntentRouter();
