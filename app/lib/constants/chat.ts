/**
 * Impact scope:
 * These constants are shared across chat runtime validation and client UI validation.
 * Changing them affects what requests are accepted and what values users can set.
 */
export const TEMPERATURE_MIN = 0;
export const TEMPERATURE_MAX = 2;
export const CHAT_MAX_MCP_SERVERS = 8;
export const CHAT_MAX_AGENT_INSTRUCTION_LENGTH = 4_000;
export const CHAT_ATTACHMENT_MAX_FILES = 5;
export const CHAT_ATTACHMENT_MAX_PDF_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES = 50 * 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_NON_PDF_FILE_SIZE_BYTES = 512 * 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES =
  CHAT_ATTACHMENT_MAX_NON_PDF_FILE_SIZE_BYTES * CHAT_ATTACHMENT_MAX_FILES;
export const CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH = 128;
export const CHAT_MODEL_RUN_TIMEOUT_MS = 120_000;
export const CHAT_CLEANUP_TIMEOUT_MS = 5_000;
export const CHAT_MAX_RUN_TURNS = 64;
export const CHAT_MAX_CONSECUTIVE_IDENTICAL_SKILL_OPERATIONS = 8;
export const CHAT_MAX_SKILL_OPERATION_CALLS_PER_SERVER_METHOD = 24;
export const CHAT_MAX_SKILL_RUN_SCRIPT_CALLS_PER_SERVER_METHOD = Math.floor(
  CHAT_MAX_RUN_TURNS * 0.75,
);
export const CHAT_MAX_IDENTICAL_SKILL_OPERATION_CALLS_PER_SIGNATURE = 1;
export const CHAT_MAX_IDENTICAL_SKILL_RUN_SCRIPT_CALLS_PER_SIGNATURE = 2;
export const CHAT_MAX_SKILL_OPERATION_ERRORS = 10;
export const CHAT_CODE_INTERPRETER_UPLOAD_TIMEOUT_MS = 30_000;
export const THREAD_ENVIRONMENT_VARIABLES_MAX = 128;
export const THREAD_ENVIRONMENT_KEY_MAX_LENGTH = 128;
export const THREAD_ENVIRONMENT_VALUE_MAX_LENGTH = 16_384;
export const CHAT_ATTACHMENT_ALLOWED_EXTENSIONS = new Set([
  "c",
  "cpp",
  "csv",
  "docx",
  "gif",
  "html",
  "java",
  "jpeg",
  "jpg",
  "js",
  "json",
  "md",
  "pdf",
  "php",
  "pkl",
  "png",
  "pptx",
  "py",
  "rb",
  "tar",
  "tex",
  "txt",
  "xlsx",
  "xml",
  "zip",
]);
export const DEFAULT_AGENT_INSTRUCTION = "You are a concise assistant for a local playground app.";
export const HOME_REASONING_EFFORT_OPTIONS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;
export const HOME_DEFAULT_REASONING_EFFORT = "none" as const;
export const HOME_DEFAULT_UTILITY_REASONING_EFFORT = "high" as const;
export const HOME_DEFAULT_WEB_SEARCH_ENABLED = false;
export const THREAD_AUTO_TITLE_MAX_LENGTH = 20;
export const THREAD_AUTO_TITLE_SYSTEM_PROMPT = [
  "<thread_auto_title_policy>",
  "  <objective>",
  "    Generate a concise thread title that summarizes the provided Playground content and Instruction.",
  "  </objective>",
  "  <output_rules>",
  `    Return a single plain-text title with at most ${THREAD_AUTO_TITLE_MAX_LENGTH} characters.`,
  "    Keep the same language as the source content.",
  "    Do not use markdown, quotes, prefixes, suffixes, or line breaks.",
  "    Do not reveal reasoning or explanations.",
  "  </output_rules>",
  "</thread_auto_title_policy>",
].join("\n");
export const THREAD_DEFAULT_NAME = "New Thread";
export const CODE_INTERPRETER_ATTACHMENT_AVAILABILITY_CACHE_MS = 10 * 60 * 1000;
