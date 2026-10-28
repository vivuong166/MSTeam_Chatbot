export type AgentIntent =
  | "course_search"
  | "course_dependency_tree"
  | "course_group_tree"
  | "general";

export type AgentTool =
  | "search_courses"
  | "course_dependency_tree"
  | "course_group_tree"
  | "none";

export type AgentReply = {
  reply: string;
  intent: AgentIntent;
  toolUsed: AgentTool;
};
