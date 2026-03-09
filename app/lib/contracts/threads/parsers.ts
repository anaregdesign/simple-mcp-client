import { DEFAULT_REASONING_EFFORT, REASONING_EFFORT_OPTIONS } from "~/lib/constants/chat";
import type { ChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import {
  readThreadOperationLogEntryFromUnknown as readThreadOperationLogEntryFromStream,
  type ThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";
import { readMcpServerFromUnknown, type McpServerConfig } from "~/lib/contracts/mcp/profile";
import { readThreadSkillActivationList } from "~/lib/contracts/skills/parsers";
import type { ReasoningEffort } from "~/lib/domain/shared/reasoning-effort";
import { readThreadEnvironmentFromUnknown } from "~/lib/contracts/threads/environment";
import { readThreadInstructionContextTogglesFromUnknown } from "~/lib/contracts/threads/instruction-context";
import type { ThreadResource, ThreadState, ThreadSummary, ThreadWritePayload } from "~/lib/contracts/threads/types";

type ReadThreadWritePayloadOptions = {
  fallbackInstruction?: string;
};

const threadWritePayloadAllowedKeys = new Set([
  "id",
  "name",
  "createdAt",
  "reasoningEffort",
  "webSearchEnabled",
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
    typeof value.threadEnvironmentJson !== "string" ||
    typeof value.instructionContextTogglesJson !== "string" ||
    !Array.isArray(value.messages) ||
    !Array.isArray(value.mcpServers) ||
    !Array.isArray(value.mcpRpcLogs) ||
    !Array.isArray(value.skillSelections)
  ) {
    return null;
  }

  return value as ThreadResource;
}

export function convertThreadResourceToState(
  resource: ThreadResource,
  options: ReadThreadWritePayloadOptions = {},
): ThreadState {
  const reasoningEffort =
    readReasoningEffortFromUnknown(resource.reasoningEffort) ?? DEFAULT_REASONING_EFFORT;

  return {
    id: resource.id,
    name: resource.name,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
    deletedAt: resource.deletedAt,
    reasoningEffort,
    webSearchEnabled: resource.webSearchEnabled === true,
    agentInstruction: readThreadInstructionContent(resource, options.fallbackInstruction),
    instructionContextToggles: readThreadInstructionContextTogglesFromUnknown(
      readJsonValue(resource.instructionContextTogglesJson, null),
    ) ?? { system: true },
    threadEnvironment: readThreadEnvironmentFromUnknown(
      readJsonValue(resource.threadEnvironmentJson, {}),
    ),
    messages: readThreadMessageResources(resource.messages),
    mcpServers: readThreadMcpServerResources(resource.mcpServers),
    mcpRpcLogs: readThreadOperationLogResources(resource.mcpRpcLogs),
    skillSelections: readThreadSkillSelectionResources(resource.skillSelections),
  };
}

export function convertThreadStateToWritePayload(state: ThreadState): ThreadWritePayload {
  return {
    id: state.id,
    name: state.name,
    createdAt: state.createdAt,
    reasoningEffort: state.reasoningEffort,
    webSearchEnabled: state.webSearchEnabled,
    instruction: {
      content: state.agentInstruction,
    },
    instructionContextToggles: { ...state.instructionContextToggles },
    threadEnvironment: { ...state.threadEnvironment },
    messages: state.messages.map((message) => ({
      ...message,
      attachments: message.attachments.map((attachment) => ({ ...attachment })),
      skillActivations: message.skillActivations.map((activation) => ({ ...activation })),
    })),
    mcpServers: state.mcpServers.map(cloneMcpServerConfig),
    mcpRpcLogs: state.mcpRpcLogs.map((entry) => ({ ...entry })),
    skillSelections: state.skillSelections.map((selection) => ({ ...selection })),
  };
}

export function readThreadStateListFromResources(
  value: unknown,
  options: ReadThreadWritePayloadOptions = {},
): ThreadState[] {
  return readThreadResourceList(value).map((resource) =>
    convertThreadResourceToState(resource, options),
  );
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
    instruction,
    instructionContextToggles,
    threadEnvironment: readThreadEnvironmentFromUnknown(value.threadEnvironment),
    messages: readThreadMessageList(value.messages),
    mcpServers: readThreadMcpServerList(value.mcpServers),
    mcpRpcLogs: readThreadOperationLogEntryList(value.mcpRpcLogs),
    skillSelections: readThreadSkillActivationList(value.skillSelections),
  };
}

export function buildThreadSummary(state: Pick<ThreadState, "id" | "name" | "createdAt" | "updatedAt" | "deletedAt" | "messages" | "mcpServers">): ThreadSummary {
  return {
    id: state.id,
    name: state.name,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    deletedAt: state.deletedAt,
    messageCount: state.messages.length,
    mcpServerCount: state.mcpServers.length,
  };
}

function readThreadInstructionContent(
  resource: ThreadResource,
  fallbackInstruction = "",
): string {
  const content = resource.instruction?.content;
  return typeof content === "string" ? content : fallbackInstruction;
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

function readThreadMessageResources(value: ThreadResource["messages"]): ThreadMessage[] {
  return value
    .map((message) => readThreadMessageResource(message))
    .filter((message): message is ThreadMessage => message !== null);
}

function readThreadMessageResource(value: ThreadResource["messages"][number]): ThreadMessage | null {
  const attachments = readChatAttachmentList(readJsonValue(value.attachmentsJson, []));

  return {
    id: value.id,
    role: value.role === "assistant" ? "assistant" : "user",
    content: value.content,
    createdAt: value.createdAt,
    turnId: value.turnId,
    attachments,
    skillActivations: value.skillActivations.map((activation) => ({
      name: activation.skillProfile.name,
      location: activation.skillProfile.location,
    })),
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

function readThreadMessageFromUnknown(value: unknown): ThreadMessage | null {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, threadMessageAllowedKeys)) {
    return null;
  }

  const id = readTrimmedString(value.id);
  const role = value.role;
  const content = typeof value.content === "string" ? value.content : "";
  const createdAt = readTrimmedString(value.createdAt);
  const turnId = readTrimmedString(value.turnId);
  if (!id || (role !== "user" && role !== "assistant") || !createdAt || !turnId) {
    return null;
  }

  return {
    id,
    role,
    content,
    createdAt,
    turnId,
    attachments: readChatAttachmentList(value.attachments),
    skillActivations: readThreadSkillActivationList(value.skillActivations),
  };
}

function readChatAttachmentList(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const attachments: ChatAttachment[] = [];
  for (const entry of value) {
    const attachment = readChatAttachmentFromUnknown(entry);
    if (!attachment) {
      continue;
    }

    attachments.push(attachment);
  }

  return attachments;
}

function readChatAttachmentFromUnknown(value: unknown): ChatAttachment | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = readTrimmedString(value.name);
  const mimeType = readTrimmedString(value.mimeType);
  const dataUrl = typeof value.dataUrl === "string" ? value.dataUrl.trim() : "";
  const sizeBytes = readSafeInteger(value.sizeBytes);
  if (!name || !mimeType || !dataUrl || sizeBytes === null || sizeBytes < 0) {
    return null;
  }

  return {
    name,
    mimeType,
    sizeBytes,
    dataUrl,
  };
}

function readThreadMcpServerResources(value: ThreadResource["mcpServers"]): McpServerConfig[] {
  return value
    .map((server) =>
      readMcpServerFromUnknown(
        server.transport === "stdio"
          ? {
              id: server.id,
              name: server.name,
              connectOnThreadCreate: false,
              transport: server.transport,
              command: server.command ?? "",
              args: readJsonValue(server.argsJson, []),
              cwd: server.cwd ?? undefined,
              env: readJsonValue(server.envJson, {}),
            }
          : {
              id: server.id,
              name: server.name,
              connectOnThreadCreate: false,
              transport: server.transport,
              url: server.url ?? "",
              headers: readJsonValue(server.headersJson, {}),
              useAzureAuth: server.useAzureAuth,
              azureAuthScope: server.azureAuthScope ?? "",
              timeoutSeconds: server.timeoutSeconds ?? 0,
            },
      ),
    )
    .filter((server): server is McpServerConfig => server !== null);
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

function readThreadOperationLogResources(
  value: ThreadResource["mcpRpcLogs"],
): ThreadOperationLogEntry[] {
  return value
    .map((entry) =>
      readThreadOperationLogEntryFromUnknown({
        id: entry.sourceRpcId,
        sequence: entry.sequence,
        operationType: entry.operationType,
        serverName: entry.serverName,
        method: entry.method,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        request: readJsonValue(entry.requestJson, null),
        response: readJsonValue(entry.responseJson, null),
        isError: entry.isError,
        turnId: entry.turnId,
      }),
    )
    .filter((entry): entry is ThreadOperationLogEntry => entry !== null);
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

function readThreadSkillSelectionResources(
  value: ThreadResource["skillSelections"],
): ThreadState["skillSelections"] {
  return value.map((selection) => ({
    name: selection.skillProfile.name,
    location: selection.skillProfile.location,
  }));
}

function cloneMcpServerConfig(server: McpServerConfig): McpServerConfig {
  return server.transport === "stdio"
    ? {
        ...server,
        args: [...server.args],
        env: { ...server.env },
      }
    : {
        ...server,
        headers: { ...server.headers },
      };
}

function readJsonValue<T>(value: string | null, fallback: T): T {
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
    REASONING_EFFORT_OPTIONS.includes(value as ReasoningEffort)
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
