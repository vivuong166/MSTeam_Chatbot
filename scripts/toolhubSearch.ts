import { ToolHubError, toolHubClient } from "../src/services/toolhubClient";

async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error("Cách dùng: npm run toolhub:search -- <mã hoặc tên học phần>");
    process.exitCode = 1;
    return;
  }

  try {
    const courses = await toolHubClient.searchCourses(query);
    console.log(JSON.stringify(courses, null, 2));
  } catch (error) {
    if (error instanceof ToolHubError) {
      console.error(`ToolHub lỗi [${error.code}]${error.status ? ` HTTP ${error.status}` : ""}: ${error.message}`);
    } else {
      console.error("Không thể kiểm tra ToolHub", error);
    }
    process.exitCode = 1;
  }
}

void main();
