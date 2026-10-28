import { intentRouter, type IntentRoute } from "./intentRouter";
import { buildCoursePrompt } from "./promptBuilder";
import type { AgentReply } from "../domain/agent";
import type { ChatRequest } from "../domain/chat";
import type { ChatMessage, ChatRole } from "../domain/chat";
import type { CourseSearchResult } from "../domain/course";
import { messageRepository } from "../repositories/messageRepository";
import { geminiClient, type GenerationResult } from "../services/geminiClient";
import { ToolHubError, toolHubClient } from "../services/toolhubClient";
import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";

type MessageRepository = {
  getRecent(userId: string): Promise<ChatMessage[]>;
  add(userId: string, role: ChatRole, content: string): Promise<void>;
};

type GeminiClient = {
  generate(history: ChatMessage[], message: string): Promise<GenerationResult>;
};

type ToolHubClient = {
  searchCourses(query: string): Promise<CourseSearchResult[]>;
};

type ChatServiceDependencies = {
  messageRepository?: MessageRepository;
  geminiClient?: GeminiClient;
  toolHubClient?: ToolHubClient;
};

const MAX_COURSE_CHOICES = 3;

function normalizeCourseCode(value: string | null): string {
  return value?.trim().toUpperCase() || "";
}

function formatCourseChoice(course: CourseSearchResult): string {
  const code = course.courseCode || "Không rõ mã";
  return course.name ? `${code} — ${course.name}` : code;
}

function buildAmbiguousCourseReply(courses: CourseSearchResult[]): string {
  const choices = courses.slice(0, MAX_COURSE_CHOICES).map(formatCourseChoice);
  return [
    "Mình tìm thấy một số học phần có thể phù hợp:",
    ...choices.map((choice) => `- ${choice}`),
    "Bạn cho mình mã học phần chính xác để mình trả lời đúng nhé."
  ].join("\n");
}

export class ChatService {
  private readonly messages: MessageRepository;
  private readonly gemini: GeminiClient;
  private readonly toolHub: ToolHubClient;

  constructor(dependencies: ChatServiceDependencies = {}) {
    this.messages = dependencies.messageRepository || messageRepository;
    this.gemini = dependencies.geminiClient || geminiClient;
    this.toolHub = dependencies.toolHubClient || toolHubClient;
  }

  async reply({ userId, message }: ChatRequest): Promise<AgentReply> {
    const route = intentRouter.route(message);
    const result = route.intent === "course_search"
      ? await this.replyToCourseSearch(route, message)
      : route.intent === "general"
        ? await this.replyToGeneralQuestion(userId, message)
        : this.replyToPlannedTree(route);

    await this.persistConversation(userId, message, result.reply);
    return result;
  }

  private async replyToGeneralQuestion(userId: string, message: string): Promise<AgentReply> {
    const history = await this.messages.getRecent(userId);
    const result = await this.gemini.generate(history, message);

    return {
      reply: this.unwrapGeminiResult(result),
      intent: "general",
      toolUsed: "none"
    };
  }

  private async replyToCourseSearch(route: IntentRoute, message: string): Promise<AgentReply> {
    const query = route.searchQuery;
    if (!query) {
      return {
        reply: "Bạn cho mình mã hoặc tên học phần cần tra cứu nhé.",
        intent: "course_search",
        toolUsed: "none"
      };
    }

    let courses: CourseSearchResult[];
    try {
      courses = await this.toolHub.searchCourses(query);
    } catch (error) {
      const code = error instanceof ToolHubError ? error.code : "TOOLHUB_UNAVAILABLE";
      logger.warn(`ToolHub course search failed code=${code}`);
      return {
        reply: "Mình chưa lấy được dữ liệu học phần từ ToolHub. Bạn vui lòng thử lại sau.",
        intent: "course_search",
        toolUsed: "search_courses"
      };
    }

    if (courses.length === 0) {
      return {
        reply: "Mình chưa tìm thấy học phần phù hợp trên ToolHub. Bạn kiểm tra lại mã hoặc tên môn nhé.",
        intent: "course_search",
        toolUsed: "search_courses"
      };
    }

    const requestedCode = route.courseCodes[0];
    const exactMatches = requestedCode
      ? courses.filter((course) => normalizeCourseCode(course.courseCode) === requestedCode)
      : [];

    if (exactMatches.length !== 1) {
      return {
        reply: buildAmbiguousCourseReply(courses),
        intent: "course_search",
        toolUsed: "search_courses"
      };
    }

    const result = await this.gemini.generate([], buildCoursePrompt(message, exactMatches[0]));
    return {
      reply: this.unwrapGeminiResult(result),
      intent: "course_search",
      toolUsed: "search_courses"
    };
  }

  private replyToPlannedTree(route: IntentRoute): AgentReply {
    const codes = route.courseCodes.length > 0 ? route.courseCodes.join(", ") : "học phần bạn nêu";
    return {
      reply:
        `Mình đã nhận yêu cầu cây phụ thuộc cho ${codes}. ` +
        "Intent này đã được nhận diện; link cây SVG sẽ được tích hợp ở Tuần 5.",
      intent: route.intent,
      toolUsed: "none"
    };
  }

  private unwrapGeminiResult(result: GenerationResult): string {

    if (!result.ok) {
      const status = result.code === "SERVICE_NOT_CONFIGURED" ? 503 : 502;
      throw new AppError(status, result.code, result.reply);
    }

    return result.reply;
  }

  private async persistConversation(userId: string, message: string, reply: string): Promise<void> {
    await this.messages.add(userId, "user", message);
    await this.messages.add(userId, "assistant", reply);
  }
}

export const chatService = new ChatService();
