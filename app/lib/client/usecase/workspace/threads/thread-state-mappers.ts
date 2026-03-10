import {
  DEFAULT_REASONING_EFFORT,
  reasoningEffortValues,
} from "~/lib/domain/value-objects/reasoning-effort";
import type { ChatAttachment } from "~/lib/contracts/chat/attachments";
import {
  readThreadMessageFromUnknown,
  type ThreadMessage,
} from "~/lib/contracts/chat/messages";
import {
  readThreadOperationLogEntryFromUnknown as readThreadOperationLogEntryFromStream,
  type ThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";
import { readMcpServerFromUnknown, type McpServerConfig } from "~/lib/contracts/mcp/profile";
import { readThreadResourceList } from "~/lib/contracts/threads/parsers";
import type { ThreadResource, ThreadWritePayload } from "~/lib/contracts/threads/types";
import { readThreadSkillActivationList } from "~/lib/contracts/skills/parsers";
import {
  cloneChatAzureConfig,
  readChatAzureConfigFromUnknown,
} from "~/lib/domain/value-objects/chat-azure-config";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import { readThreadEnvironmentFromUnknown } from "~/lib/domain/value-objects/thread-environment";
import { readThreadInstructionContextTogglesFromUnknown } from "~/lib/domain/value-objects/thread-instruction-context";
import {
  cloneMcpServers,
  cloneMessages,
  cloneThreadEnvironment,
  cloneThreadInstructionContexts,
  cloneThreadOperationLogs,
  cloneThreadSkillActivations,
  type ThreadState,
  type ThreadSummary,
} from "./thread-state";

type ReadThreadWritePayloadOptions = {
  fallbackInstruction?: string;
};

export function convertThreadResourceToState(
  resource: ThreadResource,
  options: ReadThreadWritePayloadOptions = {},
): ThreadState {
  const reasoningEffort =
    readReasoningEffortFromUnknown(resource.reasoningEffort) ??
    DEFAULT_REASONING_EFFORT;

  return {
    id: resource.id,
    name: resource.name,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
    deletedAt: resource.deletedAt,
    reasoningEffort,
    webSearchEnabled: resource.webSearchEnabled === true,
    chatAzureConfig: readChatAzureConfigFromUnknown(
      readJsonValue(resource.chatAzureConfigJson, null),
    ),
    agentInstruction: readThreadInstructionContent(
      resource,
      options.fallbackInstruction,
    ),
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

export function convertThreadStateToWritePayload(
  state: ThreadState,
): ThreadWritePayload {
  return {
    id: state.id,
    name: state.name,
    createdAt: state.createdAt,
    reasoningEffort: state.reasoningEffort,
    webSearchEnabled: state.webSearchEnabled,
    chatAzureConfig: cloneChatAzureConfig(state.chatAzureConfig),
    instruction: {
      content: state.agentInstruction,
    },
    instructionContextToggles: cloneThreadInstructionContexts(
      state.instructionContextToggles,
    ),
    threadEnvironment: cloneThreadEnvironment(state.threadEnvironment),
    messages: cloneMessages(state.messages),
    mcpServers: cloneMcpServers(state.mcpServers),
    mcpRpcLogs: cloneThreadOperationLogs(state.mcpRpcLogs),
    skillSelections: cloneThreadSkillActivations(state.skillSelections),
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

export function buildThreadSummary(
  state: Pick<
    ThreadState,
    | "id"
    | "name"
    | "createdAt"
    | "updatedAt"
    | "deletedAt"
    | "messages"
    | "mcpServers"
  >,
): ThreadSummary {
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

function readThreadOperationLogEntryFromUnknown(value: unknown): ThreadOperationLogEntry | null {
  const parsed = readThreadOperationLogEntryFromStream(value);
  if (!parsed || !isRecord(value)) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
