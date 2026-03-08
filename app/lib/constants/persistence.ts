/**
 * Impact scope:
 * These constants are shared across persisted workspace storage and runtime event-log normalization.
 * Changing them affects durable storage locations and persisted debug/event record shaping.
 */
export const FOUNDRY_LEGACY_CONFIG_DIRECTORY_NAME = ".foundry_local_playground";
export const FOUNDRY_WINDOWS_CONFIG_DIRECTORY_NAME = "FoundryLocalPlayground";
export const FOUNDRY_SQLITE_DATABASE_FILE_NAME = "local-playground.sqlite";
export const FOUNDRY_USERS_DIRECTORY_NAME = "users";
export const FOUNDRY_THREADS_DIRECTORY_NAME = "threads";
export const FOUNDRY_SKILLS_DIRECTORY_NAME = "skills";

export const APP_EVENT_LOG_MAX_CATEGORY_LENGTH = 80;
export const APP_EVENT_LOG_MAX_EVENT_NAME_LENGTH = 120;
export const APP_EVENT_LOG_MAX_MESSAGE_LENGTH = 4_000;
export const APP_EVENT_LOG_MAX_TEXT_LENGTH = 8_000;
export const APP_EVENT_LOG_MAX_PATH_LENGTH = 1_024;
export const APP_EVENT_LOG_MAX_CONTEXT_DEPTH = 6;
export const APP_EVENT_LOG_MAX_CONTEXT_KEYS = 200;
export const APP_EVENT_LOG_MAX_CONTEXT_ARRAY_ITEMS = 200;

export const THREAD_MCP_SERVER_ROW_ID_PATTERN = /^thread:[^:]+:mcp:\d+:(.+)$/;
export const THREAD_OPERATION_LOG_ROW_ID_PATTERN = /^thread:[^:]+:rpc:\d+:(.+)$/;
