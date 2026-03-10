import { createThreadMessage } from "~/lib/client/usecase/workspace/chat-session/messages";
import {
  cloneMessages,
  cloneMcpServers,
  cloneThreadInstructionContexts,
  cloneThreadOperationLogs,
  cloneThreadSkillActivations,
} from "~/lib/client/usecase/workspace/threads/thread-save-state";
import { mergeSkillSelections } from "~/lib/client/usecase/workspace/threads/thread-runtime";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";
import type {
  AzureConnectionView,
} from "~/lib/client/usecase/workspace/view-types";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { DraftChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ChatRunRequest } from "~/lib/contracts/chat/request";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import {
  cloneThreadEnvironment,
  type ThreadEnvironment,
} from "~/lib/domain/value-objects/thread-environment";
import type { ThreadInstructionContextToggles } from "~/lib/domain/value-objects/thread-instruction-context";

export type PreparedSendMessageExecution = {
  userMessage: ThreadMessage;
  threadSnapshot: ThreadState;
  requestThreadEnvironment: ThreadEnvironment;
  requestPayload: ChatRunRequest;
  requestMcpServers: McpServerConfig[];
  requestSkillSelections: ThreadSkillActivation[];
  shouldRefreshThreadTitleOnFirstMessage: boolean;
};

export function prepareSendMessageExecution(options: {
  threadId: string;
  turnId: string;
  content: string;
  draftAttachments: DraftChatAttachment[];
  messages: ThreadMessage[];
  mcpServers: McpServerConfig[];
  selectedMessageSkillActivations: ThreadSkillActivation[];
  selectedThreadSkills: ThreadSkillActivation[];
  baseThread: ThreadState;
  agentInstruction: string;
  instructionContextToggles: ThreadInstructionContextToggles;
  activeAzureTenantId: string;
  activePlaygroundAzureConnection: AzureConnectionView;
  deploymentName: string;
  isPlaygroundReasoningEffortSupported: boolean;
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
}): PreparedSendMessageExecution {
  const requestAttachments = options.draftAttachments.map(
    ({ id: _id, ...attachment }) => attachment,
  );
  const requestMcpServers = cloneMcpServers(options.mcpServers);
  const requestMessageSkillActivations = cloneThreadSkillActivations(
    options.selectedMessageSkillActivations,
  );
  const requestSkillSelections = mergeSkillSelections(
    options.selectedThreadSkills,
    requestMessageSkillActivations,
  );
  const requestInstructionContextToggles = cloneThreadInstructionContexts(
    options.instructionContextToggles,
  );
  const userMessage = createThreadMessage(
    "user",
    options.content,
    options.turnId,
    requestAttachments,
    requestMessageSkillActivations,
  );
  const requestThreadEnvironment = cloneThreadEnvironment(
    options.baseThread.threadEnvironment,
  );
  const threadSnapshot: ThreadState = {
    ...options.baseThread,
    updatedAt: new Date().toISOString(),
    reasoningEffort: options.reasoningEffort,
    webSearchEnabled: options.webSearchEnabled,
    chatAzureConfig: {
      tenantId: options.activeAzureTenantId,
      projectId: options.activePlaygroundAzureConnection.id ?? "",
      projectName: options.activePlaygroundAzureConnection.projectName,
      baseUrl: options.activePlaygroundAzureConnection.baseUrl,
      apiVersion: options.activePlaygroundAzureConnection.apiVersion,
      deploymentName: options.deploymentName,
    },
    agentInstruction: options.agentInstruction,
    instructionContextToggles: requestInstructionContextToggles,
    threadEnvironment: requestThreadEnvironment,
    messages: [...cloneMessages(options.messages), userMessage],
    mcpServers: requestMcpServers,
    mcpRpcLogs: cloneThreadOperationLogs(options.baseThread.mcpRpcLogs),
    skillSelections: cloneThreadSkillActivations(options.selectedThreadSkills),
  };

  return {
    userMessage,
    threadSnapshot,
    requestThreadEnvironment,
    requestPayload: {
      threadId: options.threadId,
      turnId: options.turnId,
    },
    requestMcpServers,
    requestSkillSelections,
    shouldRefreshThreadTitleOnFirstMessage:
      options.baseThread.deletedAt === null &&
      options.baseThread.messages.length === 0,
  };
}
