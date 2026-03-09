/**
 * Client controller runtime module.
 */
import type { InstructionLanguage } from "~/lib/client/usecase/workspace/view-types";
import type { WorkspaceMcpServerProfileResource } from "~/lib/contracts/mcp/profile";
import type { ThreadResource } from "~/lib/contracts/threads/types";

/**
 * Diff-review payload for instruction enhancement.
 * The controller keeps both variants so the user can choose which one to adopt.
 */
export type InstructionEnhanceComparison = {
  original: string;
  enhanced: string;
  extension: string;
  language: InstructionLanguage;
  diffPatch: string;
};

/**
 * Response shape returned by `/api/mcp/servers` and `/api/mcp/servers/:serverId`.
 */
export type McpServersApiResponse = {
  profile?: WorkspaceMcpServerProfileResource;
  profiles?: WorkspaceMcpServerProfileResource[];
  warning?: string;
  authRequired?: boolean;
  error?: string;
};

/**
 * Response shape returned by `/api/threads` and `/api/threads/:threadId`.
 */
export type ThreadsApiResponse = {
  threads?: ThreadResource[];
  thread?: ThreadResource;
  authRequired?: boolean;
  error?: string;
};

/**
 * Response shape returned by `/api/skills` and
 * `/api/skills/registries/:registryId/skills/*`.
 */
export type SkillsApiResponse = {
  skills?: unknown;
  registries?: unknown;
  skillWarnings?: unknown;
  registryWarnings?: unknown;
  warnings?: unknown;
  message?: string;
  authRequired?: boolean;
  error?: string;
};

/**
 * Response shape returned by `/api/threads/title-suggestions`.
 */
export type ThreadTitleApiResponse = {
  title?: string;
  error?: string;
  errorCode?: "azure_login_required";
};

/**
 * Per-thread request lifecycle state for chat streaming UI.
 */
export type ThreadRequestState = {
  isSending: boolean;
  sendProgressMessages: string[];
  activeTurnId: string | null;
  lastErrorTurnId: string | null;
  error: string | null;
};
