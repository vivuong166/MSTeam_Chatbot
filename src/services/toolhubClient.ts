import { env } from "../config/env";
import type { CourseSearchResult } from "../domain/course";
import { logger } from "../utils/logger";

const MAX_SEARCH_QUERY_LENGTH = 256;

export type ToolHubErrorCode =
  | "INVALID_COURSE_QUERY"
  | "TOOLHUB_TIMEOUT"
  | "TOOLHUB_UNAVAILABLE"
  | "TOOLHUB_REQUEST_FAILED"
  | "TOOLHUB_INVALID_RESPONSE";

export class ToolHubError extends Error {
  constructor(
    public readonly code: ToolHubErrorCode,
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ToolHubError";
  }
}

type ToolHubClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  retryCount?: number;
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
};

type ToolHubItem = {
  row?: unknown;
};

const COURSE_FIELDS = {
  courseCode: "Mã học phần",
  name: "Tên học phần",
  credits: "Số tín chỉ",
  tuitionCredits: "TC học phí",
  duration: "Thời lượng",
  managingFaculty: "Viện Quản lý",
  prerequisites: "Học phần điều kiện",
  objectives: "Mục tiêu",
  content: "Nội dung",
  englishName: "Tên tiếng anh"
} as const;

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeFieldName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
}

function readText(row: Record<string, unknown>, fieldName: string): string | null {
  const normalizedFieldName = normalizeFieldName(fieldName);
  const entry = Object.entries(row).find(
    ([key]) => normalizeFieldName(key) === normalizedFieldName
  );

  if (!entry) {
    return null;
  }

  const value = entry[1];
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeCourse(item: ToolHubItem): CourseSearchResult | null {
  if (!isRecord(item.row)) {
    return null;
  }

  const course: CourseSearchResult = {
    courseCode: readText(item.row, COURSE_FIELDS.courseCode),
    name: readText(item.row, COURSE_FIELDS.name),
    credits: readText(item.row, COURSE_FIELDS.credits),
    tuitionCredits: readText(item.row, COURSE_FIELDS.tuitionCredits),
    duration: readText(item.row, COURSE_FIELDS.duration),
    managingFaculty: readText(item.row, COURSE_FIELDS.managingFaculty),
    prerequisites: readText(item.row, COURSE_FIELDS.prerequisites),
    objectives: readText(item.row, COURSE_FIELDS.objectives),
    content: readText(item.row, COURSE_FIELDS.content),
    englishName: readText(item.row, COURSE_FIELDS.englishName)
  };

  return course.courseCode || course.name ? course : null;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export class ToolHubClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retryCount: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(options: ToolHubClientOptions = {}) {
    this.baseUrl = (options.baseUrl || env.toolhub.baseUrl).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs || env.toolhub.timeoutMs;
    this.retryCount = options.retryCount ?? env.toolhub.retryCount;
    this.fetchImpl = options.fetch || fetch;
    this.sleep = options.sleep || defaultSleep;
  }

  async searchCourses(query: string): Promise<CourseSearchResult[]> {
    const normalizedQuery = this.validateQuery(query);
    const url = new URL("hust/HocPhan", `${this.baseUrl}/`);
    url.searchParams.set("search", normalizedQuery);

    for (let attempt = 0; attempt <= this.retryCount; attempt += 1) {
      try {
        const courses = await this.requestCourses(url);
        logger.info(
          `ToolHub course search completed queryLength=${normalizedQuery.length} results=${courses.length}`
        );
        return courses;
      } catch (error) {
        const shouldRetry =
          error instanceof ToolHubError &&
          (error.code === "TOOLHUB_TIMEOUT" || error.code === "TOOLHUB_UNAVAILABLE") &&
          attempt < this.retryCount;

        if (!shouldRetry) {
          throw error;
        }

        logger.warn(
          `ToolHub course search retry=${attempt + 1} queryLength=${normalizedQuery.length}`
        );
        await this.sleep(250 * (attempt + 1));
      }
    }

    throw new ToolHubError("TOOLHUB_UNAVAILABLE", "Không thể kết nối ToolHub");
  }

  private validateQuery(query: string): string {
    if (typeof query !== "string") {
      throw new ToolHubError("INVALID_COURSE_QUERY", "Từ khóa tìm kiếm phải là chuỗi");
    }

    const normalized = query.trim();
    if (!normalized || normalized.length > MAX_SEARCH_QUERY_LENGTH) {
      throw new ToolHubError(
        "INVALID_COURSE_QUERY",
        `Từ khóa tìm kiếm phải có từ 1 đến ${MAX_SEARCH_QUERY_LENGTH} ký tự`
      );
    }

    return normalized;
  }

  private async requestCourses(url: URL): Promise<CourseSearchResult[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new ToolHubError("TOOLHUB_TIMEOUT", "ToolHub phản hồi quá thời gian chờ");
      }

      throw new ToolHubError("TOOLHUB_UNAVAILABLE", "Không thể kết nối ToolHub");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (isTransientStatus(response.status)) {
        throw new ToolHubError(
          "TOOLHUB_UNAVAILABLE",
          "ToolHub hiện không sẵn sàng",
          response.status
        );
      }

      throw new ToolHubError(
        "TOOLHUB_REQUEST_FAILED",
        `ToolHub trả về HTTP ${response.status}`,
        response.status
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ToolHubError(
        "TOOLHUB_INVALID_RESPONSE",
        "ToolHub trả về dữ liệu không phải JSON hợp lệ"
      );
    }

    if (!Array.isArray(data)) {
      throw new ToolHubError(
        "TOOLHUB_INVALID_RESPONSE",
        "ToolHub trả về cấu trúc dữ liệu không hợp lệ"
      );
    }

    const courses = data
      .filter(isRecord)
      .map((item) => normalizeCourse(item as ToolHubItem))
      .filter((course): course is CourseSearchResult => course !== null);

    return courses;
  }
}

export const toolHubClient = new ToolHubClient();
