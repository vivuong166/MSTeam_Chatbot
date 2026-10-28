import assert from "node:assert/strict";
import test from "node:test";
import { ChatService } from "./chatService";
import type { ChatMessage, ChatRole } from "../domain/chat";
import type { CourseSearchResult } from "../domain/course";
import type { GenerationResult } from "../services/geminiClient";
import { ToolHubError } from "../services/toolhubClient";

const course: CourseSearchResult = {
  courseCode: "IT4735",
  name: "Hệ nhúng",
  credits: "3",
  tuitionCredits: null,
  duration: null,
  managingFaculty: null,
  prerequisites: "IT3030/IT3010",
  objectives: null,
  content: null,
  englishName: null
};

class FakeMessageRepository {
  public readonly saved: Array<{ userId: string; role: ChatRole; content: string }> = [];

  async getRecent(): Promise<ChatMessage[]> {
    return [];
  }

  async add(userId: string, role: ChatRole, content: string): Promise<void> {
    this.saved.push({ userId, role, content });
  }
}

class FakeGeminiClient {
  public calls: Array<{ history: ChatMessage[]; message: string }> = [];

  async generate(history: ChatMessage[], message: string): Promise<GenerationResult> {
    this.calls.push({ history, message });
    return { ok: true, reply: "Phản hồi từ Gemini" };
  }
}

class FakeToolHubClient {
  public calls: string[] = [];

  constructor(private readonly results: CourseSearchResult[]) {}

  async searchCourses(query: string): Promise<CourseSearchResult[]> {
    this.calls.push(query);
    return this.results;
  }
}

function createService(results: CourseSearchResult[]) {
  const messages = new FakeMessageRepository();
  const gemini = new FakeGeminiClient();
  const toolHub = new FakeToolHubClient(results);
  const service = new ChatService({ messageRepository: messages, geminiClient: gemini, toolHubClient: toolHub });
  return { service, messages, gemini, toolHub };
}

test("uses ToolHub data and no history for an exact course-code question", async () => {
  const { service, gemini, toolHub } = createService([course]);

  const result = await service.reply({ userId: "student-1", message: "Điều kiện để học IT4735 là gì?" });

  assert.equal(result.intent, "course_search");
  assert.equal(result.toolUsed, "search_courses");
  assert.deepEqual(toolHub.calls, ["IT4735"]);
  assert.equal(gemini.calls.length, 1);
  assert.deepEqual(gemini.calls[0].history, []);
  assert.match(gemini.calls[0].message, /IT3030\/IT3010/);
});

test("asks for clarification for an ambiguous course-name search without calling Gemini", async () => {
  const { service, gemini, toolHub } = createService([
    { ...course, courseCode: "IT3030", name: "Kiến trúc máy tính" },
    { ...course, courseCode: "BIT3030", name: "Kiến trúc máy tính" },
    { ...course, courseCode: "IT3030E", name: "Computer Architecture" },
    { ...course, courseCode: "IT9999", name: "Không hiển thị vì quá ba lựa chọn" }
  ]);

  const result = await service.reply({ userId: "student-1", message: "Kiến trúc máy tính học gì?" });

  assert.equal(result.intent, "course_search");
  assert.equal(result.toolUsed, "search_courses");
  assert.equal(gemini.calls.length, 0);
  assert.equal(toolHub.calls.length, 1);
  assert.match(result.reply, /IT3030/);
  assert.match(result.reply, /BIT3030/);
  assert.match(result.reply, /IT3030E/);
  assert.doesNotMatch(result.reply, /IT9999/);
});

test("sends a general question to Gemini without calling ToolHub", async () => {
  const { service, gemini, toolHub } = createService([]);

  const result = await service.reply({ userId: "student-1", message: "Giải thích REST API là gì?" });

  assert.equal(result.intent, "general");
  assert.equal(result.toolUsed, "none");
  assert.equal(toolHub.calls.length, 0);
  assert.equal(gemini.calls.length, 1);
});

test("recognizes a dependency-tree request without calling a Week 5 endpoint early", async () => {
  const { service, gemini, toolHub } = createService([]);

  const result = await service.reply({ userId: "student-1", message: "Vẽ cây phụ thuộc IT3030" });

  assert.equal(result.intent, "course_dependency_tree");
  assert.equal(result.toolUsed, "none");
  assert.equal(toolHub.calls.length, 0);
  assert.equal(gemini.calls.length, 0);
  assert.match(result.reply, /Tuần 5/);
});

test("reports a ToolHub failure transparently instead of asking Gemini to guess", async () => {
  const messages = new FakeMessageRepository();
  const gemini = new FakeGeminiClient();
  const service = new ChatService({
    messageRepository: messages,
    geminiClient: gemini,
    toolHubClient: {
      async searchCourses(): Promise<CourseSearchResult[]> {
        throw new ToolHubError("TOOLHUB_UNAVAILABLE", "ToolHub hiện không sẵn sàng");
      }
    }
  });

  const result = await service.reply({ userId: "student-1", message: "IT4735 học gì?" });

  assert.equal(result.intent, "course_search");
  assert.equal(result.toolUsed, "search_courses");
  assert.equal(gemini.calls.length, 0);
  assert.match(result.reply, /chưa lấy được dữ liệu học phần từ ToolHub/i);
});
