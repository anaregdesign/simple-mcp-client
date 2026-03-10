import {
  CHAT_MAX_AGENT_INSTRUCTION_LENGTH,
  REASONING_EFFORT_OPTIONS,
} from "~/lib/constants/chat";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import { normalizeAzureOpenAIBaseURL } from "~/lib/server/usecase/azure/azure-openai-url";
import type {
  ResolvedThreadTitleAzureConfig,
  ThreadTitleSuggestionRequest,
} from "~/lib/server/usecase/threads/thread-title-suggestion-service";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const THREAD_TITLE_MAX_PLAYGROUND_CONTENT_LENGTH = 12_000;

type ThreadTitleSuggestionValidationCode =
  | "invalid_playground_content"
  | "invalid_reasoning_effort"
  | "invalid_azure_config"
  | "missing_azure_base_url"
  | "missing_azure_deployment_name"
  | "invalid_azure_api_version";

export type ThreadTitleSuggestionValidationIssue = {
  statusCode: 422;
  code: ThreadTitleSuggestionValidationCode;
  error: string;
  eventName: ThreadTitleSuggestionValidationCode;
  action: "validate_payload";
  message: string;
};

export type ThreadTitleSuggestionRequestResult =
  | {
      ok: true;
      value: ThreadTitleSuggestionRequest;
    }
  | {
      ok: false;
      issue: ThreadTitleSuggestionValidationIssue;
    };

export function readThreadTitleSuggestionRequest(
  payload: unknown,
): ThreadTitleSuggestionRequestResult {
  const playgroundContentResult = readPlaygroundContent(payload);
  if (!playgroundContentResult.ok) {
    return validationIssue(
      "invalid_playground_content",
      playgroundContentResult.error,
    );
  }

  const instruction = readInstruction(payload);
  let reasoningEffort: ReasoningEffort | null = null;
  if (supportsReasoningEffort(payload)) {
    const reasoningEffortResult = parseThreadTitleReasoningEffort(payload);
    if (!reasoningEffortResult.ok) {
      return validationIssue(
        "invalid_reasoning_effort",
        reasoningEffortResult.error,
      );
    }
    reasoningEffort = reasoningEffortResult.value;
  }

  const azureConfigResult = readAzureConfig(payload);
  if (!azureConfigResult.ok) {
    return validationIssue("invalid_azure_config", azureConfigResult.error);
  }

  if (!azureConfigResult.value.baseUrl) {
    return validationIssue(
      "missing_azure_base_url",
      "Azure OpenAI base URL is missing.",
    );
  }

  if (!azureConfigResult.value.deploymentName) {
    return validationIssue(
      "missing_azure_deployment_name",
      "Azure deployment name is missing.",
    );
  }

  if (azureConfigResult.value.apiVersion !== "v1") {
    return validationIssue(
      "invalid_azure_api_version",
      "Azure OpenAI v1 endpoint requires `apiVersion` to be `v1`.",
    );
  }

  return {
    ok: true,
    value: {
      playgroundContent: playgroundContentResult.value,
      instruction,
      azureConfig: azureConfigResult.value,
      reasoningEffort,
    },
  };
}

export function parseThreadTitleReasoningEffort(
  payload: unknown,
): ParseResult<ReasoningEffort> {
  if (!isRecord(payload)) {
    return { ok: true, value: "high" };
  }

  const value = payload.reasoningEffort;
  if (value === undefined || value === null) {
    return { ok: true, value: "high" };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "`reasoningEffort` must be a string." };
  }

  const normalized = value.trim();
  if (REASONING_EFFORT_OPTIONS.includes(normalized as ReasoningEffort)) {
    return { ok: true, value: normalized as ReasoningEffort };
  }

  return {
    ok: false,
    error: `\`reasoningEffort\` must be one of: ${REASONING_EFFORT_OPTIONS.join(", ")}.`,
  };
}

function readPlaygroundContent(payload: unknown): ParseResult<string> {
  if (!isRecord(payload)) {
    return { ok: false, error: "`playgroundContent` is required." };
  }

  const value = payload.playgroundContent;
  if (typeof value !== "string") {
    return { ok: false, error: "`playgroundContent` must be a string." };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "`playgroundContent` is required." };
  }

  if (Array.from(trimmed).length > THREAD_TITLE_MAX_PLAYGROUND_CONTENT_LENGTH) {
    return {
      ok: false,
      error: `\`playgroundContent\` must be ${THREAD_TITLE_MAX_PLAYGROUND_CONTENT_LENGTH} characters or fewer.`,
    };
  }

  return { ok: true, value: trimmed };
}

function readInstruction(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.instruction !== "string") {
    return "";
  }

  return payload.instruction.trim().slice(0, CHAT_MAX_AGENT_INSTRUCTION_LENGTH);
}

function supportsReasoningEffort(payload: unknown): boolean {
  if (!isRecord(payload)) {
    return true;
  }

  return payload.supportsReasoningEffort !== false;
}

function readAzureConfig(
  payload: unknown,
): ParseResult<ResolvedThreadTitleAzureConfig> {
  if (!isRecord(payload)) {
    return { ok: false, error: "`azureConfig` is required." };
  }

  const value = payload.azureConfig;
  if (value === undefined || value === null) {
    return { ok: false, error: "`azureConfig` is required." };
  }

  if (!isRecord(value)) {
    return { ok: false, error: "`azureConfig` must be an object." };
  }

  if (value.projectName !== undefined && typeof value.projectName !== "string") {
    return { ok: false, error: "`azureConfig.projectName` must be a string." };
  }

  if (value.tenantId !== undefined && typeof value.tenantId !== "string") {
    return { ok: false, error: "`azureConfig.tenantId` must be a string." };
  }

  if (value.baseUrl !== undefined && typeof value.baseUrl !== "string") {
    return { ok: false, error: "`azureConfig.baseUrl` must be a string." };
  }

  if (value.apiVersion !== undefined && typeof value.apiVersion !== "string") {
    return { ok: false, error: "`azureConfig.apiVersion` must be a string." };
  }

  if (
    value.deploymentName !== undefined &&
    typeof value.deploymentName !== "string"
  ) {
    return {
      ok: false,
      error: "`azureConfig.deploymentName` must be a string.",
    };
  }

  const tenantId =
    typeof value.tenantId === "string" ? value.tenantId.trim() : "";
  if (!tenantId) {
    return { ok: false, error: "`azureConfig.tenantId` is required." };
  }

  return {
    ok: true,
    value: {
      tenantId,
      projectName:
        typeof value.projectName === "string" ? value.projectName.trim() : "",
      baseUrl:
        typeof value.baseUrl === "string"
          ? normalizeAzureOpenAIBaseURL(value.baseUrl)
          : "",
      apiVersion:
        typeof value.apiVersion === "string" ? value.apiVersion.trim() : "",
      deploymentName:
        typeof value.deploymentName === "string"
          ? value.deploymentName.trim()
          : "",
    },
  };
}

function validationIssue(
  code: ThreadTitleSuggestionValidationCode,
  error: string,
): ThreadTitleSuggestionRequestResult {
  return {
    ok: false,
    issue: {
      statusCode: 422,
      code,
      error,
      eventName: code,
      action: "validate_payload",
      message: error,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
