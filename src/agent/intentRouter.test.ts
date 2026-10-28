import assert from "node:assert/strict";
import test from "node:test";
import { IntentRouter } from "./intentRouter";

const router = new IntentRouter();

test("routes an explicit course code to course_search", () => {
  const route = router.route("Điều kiện để học IT4735 là gì?");

  assert.equal(route.intent, "course_search");
  assert.deepEqual(route.courseCodes, ["IT4735"]);
  assert.equal(route.searchQuery, "IT4735");
});

test("routes an ambiguous course name to course_search without inventing a code", () => {
  const route = router.route("Kiến trúc máy tính học gì?");

  assert.equal(route.intent, "course_search");
  assert.deepEqual(route.courseCodes, []);
  assert.equal(route.searchQuery, "Kiến trúc máy tính học gì?");
});

test("routes a single-course dependency-tree request", () => {
  const route = router.route("Vẽ cây phụ thuộc IT3030");

  assert.equal(route.intent, "course_dependency_tree");
  assert.deepEqual(route.courseCodes, ["IT3030"]);
});

test("recognizes a dependency-tree request written without Vietnamese accents", () => {
  const route = router.route("Ve cay phu thuoc IT3030");

  assert.equal(route.intent, "course_dependency_tree");
});

test("routes a multi-course dependency-tree request", () => {
  const route = router.route("Vẽ cây phụ thuộc IT3030 và IT4735");

  assert.equal(route.intent, "course_group_tree");
  assert.deepEqual(route.courseCodes, ["IT3030", "IT4735"]);
});

test("does not send a general REST question to ToolHub", () => {
  const route = router.route("Giải thích REST API là gì?");

  assert.equal(route.intent, "general");
  assert.equal(route.searchQuery, null);
});
