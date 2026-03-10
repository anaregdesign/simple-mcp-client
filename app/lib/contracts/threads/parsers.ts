import {
  reasoningEffortValues,
} from "~/lib/domain/value-objects/reasoning-effort";
import {
  readThreadMessageFromUnknown,
  type ThreadMessage,
} from "~/lib/contracts/chat/messages";
import {
  readThreadOperationLogEntryFromUnknown as readThreadOperationLogEntryFromStream,
  type ThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";
import {
  readChatAzureConfigFromUnknown,
} from "~/lib/domain/value-objects/chat-azure-config";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import { readThreadEnvironmentFromUnknown } from "~/lib/domain/value-objects/thread-environment";
import { readThreadInstructionContextTogglesFromUnknown } from "~/lib/domain/value-objects/thread-instruction-context";
import { readMcpServerFromUnknown, type McpServerConfig } from "~/lib/contracts/mcp/profile";
import { readThreadSkillActivationList } from "~/lib/contracts/skills/parsers";
import type { ThreadResource, ThreadWritePayload } from "~/lib/contracts/threads/types";

type ReadThreadWritePayloadOptions = {
  fallbackInstruction?: string;
};

const threadWritePayloadAllowedKeys = new Set([
  "id",
  "name",
  "createdAt",
  "reasoningEffort",
  "webSearchEnabled",
  "chatAzureConfig",
  "instruction",
  "instructionContextToggles",
  "threadEnvironment",
  "messages",
  "mcpServers",
  "mcpRpcLogs",
  "skillSelections",
]);

const threadInstructionAllowedKeys = new Set(["content"]);
const threadMessageAllowedKeys = new Set([
  "id",
  "role",
  "content",
  "createdAt",
  "turnId",
  "attachments",
  "skillActivations",
]);
const threadOperationLogAllowedKeys = new Set([
  "id",
  "sequence",
  "operationType",
  "serverName",
  "method",
  "startedAt",
  "completedAt",
  "request",
  "response",
  "isError",
  "turnId",
]);

export function readThreadResourceList(value: unknown): ThreadResource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const resources: ThreadResource[] = [];
  const seenIds = new Set<string>();
  for (const entry of value) {
    const resource = readThreadResourceFromUnknown(entry);
    if (!resource || seenIds.has(resource.id)) {
      continue;
    }

    seenIds.add(resource.id);
    resources.push(resource);
  }

  return resources;
}

export function readThreadResourceFromUnknown(value: unknown): ThreadResource | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.userId !== "number" ||
    typeof value.name !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !("deletedAt" in value) ||
    typeof value.reasoningEffort !== "string" ||
    typeof value.webSearchEnabled !== "boolean" ||
    ("chatAzureConfigJson" in value &&
      value.chatAzureConfigJson !== null &&
      typeof value.chatAzureConfigJson !== "string") ||
    typeof value.threadEnvironmentJson !== "string" ||
    typeof value.instructionContextTogglesJson !== "string" ||
    !Array.isArray(value.messages) ||
    !Array.isArray(value.mcpServers) ||
    !Array.isArray(value.mcpRpcLogs) ||
    !Array.isArray(value.skillSelections)
  ) {
    return null;
  }

  return {
    ...value,
    chatAzureConfigJson:
      typeof value.chatAzureConfigJson === "string"
        ? value.chatAzureConfigJson
        : null,
  } as ThreadResource;
}

export function readThreadWritePayloadFromUnknown(
  value: unknown,
  options: ReadThreadWritePayloadOptions = {},
): ThreadWritePayload | null {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, threadWritePayloadAllowedKeys)) {
    return null;
  }

  const id = readTrimmedString(value.id);
  const name = readTrimmedString(value.name);
  const createdAt = readTrimmedString(value.createdAt);
  const reasoningEffort = readReasoningEffortFromUnknown(value.reasoningEffort);
  const webSearchEnabled = readBooleanFromUnknown(value.webSearchEnabled);
  if (!id || !name || !createdAt || !reasoningEffort || webSearchEnabled === null) {
    return null;
  }

  const chatAzureConfig = readChatAzureConfigFromUnknown(value.chatAzureConfig);
  if (value.chatAzureConfig !== undefined && value.chatAzureConfig !== null && !chatAzureConfig) {
    return null;
  }

  const instruction = readThreadInstructionWritePayload(value.instruction, options.fallbackInstruction);
  if (!instruction) {
    return null;
  }

  const instructionContextToggles = readThreadInstructionContextTogglesFromUnknown(
    value.instructionContextToggles,
  );
  if (!instructionContextToggles) {
    return null;
  }

  return {
    id,
    name,
    createdAt,
    reasoningEffort,
    webSearchEnabled,
    chatAzureConfig,
    instruction,
    instructionContextToggles,
    threadEnvironment: readThreadEnvironmentFromUnknown(value.threadEnvironment),
    messages: readThreadMessageList(value.messages),
    mcpServers: readThreadMcpServerList(value.mcpServers),
    mcpRpcLogs: readThreadOperationLogEntryList(value.mcpRpcLogs),
    skillSelections: readThreadSkillActivationList(value.skillSelections),
  };
}

function readThreadInstructionWritePayload(
  value: unknown,
  fallbackInstruction = "",
): ThreadWritePayload["instruction"] | null {
  if (value === undefined) {
    return {
      content: fallbackInstruction,
    };
  }

  if (!isRecord(value) || !hasOnlyAllowedKeys(value, threadInstructionAllowedKeys)) {
    return null;
  }

  const content = typeof value.content === "string" ? value.content : fallbackInstruction;
  return {
    content,
  };
}

function readThreadMessageList(value: unknown): ThreadMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const messages: ThreadMessage[] = [];
  const seenIds = new Set<string>();

  for (const entry of value) {
    const message = readThreadMessageFromUnknown(entry);
    if (!message || seenIds.has(message.id)) {
      continue;
    }

    seenIds.add(message.id);
    messages.push(message);
  }

  return messages;
}

function readThreadMcpServerList(value: unknown): McpServerConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const servers: McpServerConfig[] = [];
  const seenIds = new Set<string>();

  for (const entry of value) {
    const server = readMcpServerFromUnknown(entry);
    if (!server || seenIds.has(server.id)) {
      continue;
    }

    seenIds.add(server.id);
    servers.push(server);
  }

  return servers;
}

function readThreadOperationLogEntryList(value: unknown): ThreadOperationLogEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: ThreadOperationLogEntry[] = [];
  const seenIds = new Set<string>();

  for (const entry of value) {
    const parsed = readThreadOperationLogEntryFromUnknown(entry);
    if (!parsed || seenIds.has(parsed.id)) {
      continue;
    }

    seenIds.add(parsed.id);
    entries.push(parsed);
  }

  return entries;
}

function readThreadOperationLogEntryFromUnknown(value: unknown): ThreadOperationLogEntry | null {
  const parsed = readThreadOperationLogEntryFromStream(value);
  if (!parsed || !isRecord(value) || !hasOnlyAllowedKeys(value, threadOperationLogAllowedKeys)) {
    return null;
  }

  const turnId = readTrimmedString(value.turnId);
  if (!turnId) {
    return null;
  }

  return {
    ...parsed,
    turnId,
  };
}

function readJsonValue<T>(value: string | null | undefined, fallback: T): T {
  if (typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function hasOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readSafeInteger(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isSafeInteger(value)
  ) {
    return null;
  }

  return value;
}

function readReasoningEffortFromUnknown(value: unknown): ReasoningEffort | null {
  if (
    typeof value === "string" &&
    reasoningEffortValues.includes(value as ReasoningEffort)
  ) {
    return value as ReasoningEffort;
  }

  return null;
}

function readBooleanFromUnknown(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
