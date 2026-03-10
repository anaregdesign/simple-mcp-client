/**
 * Impact scope:
 * These constants are shared across persisted workspace storage.
 * Changing them affects durable storage locations and persisted debug record shaping.
 */
export const LEGACY_WORKSPACE_STORAGE_DIRECTORY_NAME =
  ".foundry_local_playground";
export const WINDOWS_WORKSPACE_STORAGE_DIRECTORY_NAME =
  "FoundryLocalPlayground";
export const LOCAL_PLAYGROUND_SQLITE_DATABASE_FILE_NAME =
  "local-playground.sqlite";
export const WORKSPACE_USERS_DIRECTORY_NAME = "users";
export const WORKSPACE_THREADS_DIRECTORY_NAME = "threads";
export const WORKSPACE_SKILLS_DIRECTORY_NAME = "skills";

export const THREAD_MCP_SERVER_ROW_ID_PATTERN = /^thread:[^:]+:mcp:\d+:(.+)$/;
export const THREAD_OPERATION_LOG_ROW_ID_PATTERN =
  /^thread:[^:]+:rpc:\d+:(.+)$/;
