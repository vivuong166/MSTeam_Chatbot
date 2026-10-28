import assert from "node:assert/strict";
import test from "node:test";
import { ToolHubClient, ToolHubError } from "./toolhubClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("searchCourses normalizes item.row and URL-encodes Vietnamese queries", async () => {
  const requestedUrls: string[] = [];
  const client = new ToolHubClient({
    baseUrl: "https://toolhub.example",
    fetch: async (input) => {
      requestedUrls.push(String(input));
      return jsonResponse([
        {
          row: {
            "Mã học phần": "IT3030",
            "Tên học phần": "Kiến trúc máy tính",
            "Số tín chỉ": 3,
            "Học phần điều kiện": "IT3010",
            "Tên tiếng anh": "Computer Architecture"
          }
        }
      ]);
    }
  });

  const courses = await client.searchCourses("  Kiến trúc máy tính  ");

  assert.equal(new URL(requestedUrls[0]).searchParams.get("search"), "Kiến trúc máy tính");
  assert.deepEqual(courses, [
    {
      courseCode: "IT3030",
      name: "Kiến trúc máy tính",
      credits: "3",
      tuitionCredits: null,
      duration: null,
      managingFaculty: null,
      prerequisites: "IT3010",
      objectives: null,
      content: null,
      englishName: "Computer Architecture"
    }
  ]);
});

test("searchCourses returns an empty list when ToolHub finds no courses", async () => {
  const client = new ToolHubClient({
    fetch: async () => jsonResponse([])
  });

  assert.deepEqual(await client.searchCourses("không tồn tại"), []);
});

test("searchCourses retries a transient ToolHub error once", async () => {
  let calls = 0;
  const client = new ToolHubClient({
    retryCount: 1,
    sleep: async () => undefined,
    fetch: async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse({ error: "temporary" }, 503)
        : jsonResponse([{ row: { "Mã học phần": "IT3030", "Tên học phần": "Kiến trúc" } }]);
    }
  });

  const courses = await client.searchCourses("IT3030");
  assert.equal(calls, 2);
  assert.equal(courses[0].courseCode, "IT3030");
});

test("searchCourses does not retry a permanent ToolHub HTTP error", async () => {
  let calls = 0;
  const client = new ToolHubClient({
    retryCount: 1,
    sleep: async () => undefined,
    fetch: async () => {
      calls += 1;
      return jsonResponse({ error: "bad request" }, 400);
    }
  });

  await assert.rejects(client.searchCourses("IT3030"), (error: unknown) =>
    error instanceof ToolHubError &&
    error.code === "TOOLHUB_REQUEST_FAILED" &&
    error.status === 400
  );
  assert.equal(calls, 1);
});

test("searchCourses converts an aborted request into a timeout error", async () => {
  const client = new ToolHubClient({
    timeoutMs: 10,
    retryCount: 0,
    fetch: async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
  });

  await assert.rejects(client.searchCourses("IT3030"), (error: unknown) =>
    error instanceof ToolHubError && error.code === "TOOLHUB_TIMEOUT"
  );
});

test("searchCourses rejects malformed ToolHub data without inventing a course", async () => {
  const client = new ToolHubClient({
    fetch: async () => jsonResponse({ row: { "Mã học phần": "IT3030" } })
  });

  await assert.rejects(client.searchCourses("IT3030"), (error: unknown) =>
    error instanceof ToolHubError && error.code === "TOOLHUB_INVALID_RESPONSE"
  );
});

test("searchCourses validates the query before making a request", async () => {
  const client = new ToolHubClient({
    fetch: async () => {
      throw new Error("fetch must not be called");
    }
  });

  await assert.rejects(client.searchCourses("  "), (error: unknown) =>
    error instanceof ToolHubError && error.code === "INVALID_COURSE_QUERY"
  );
});
