import {
  createCodeInterpreterContainerWithAttachments,
  deleteCodeInterpreterContainer,
} from "~/lib/server/infrastructure/gateways/chat/code-interpreter-attachment-gateway";
import {
  getAzureBearerTokenForScope,
} from "~/lib/server/infrastructure/gateways/azure/azure-openai-gateway";
import { runChatAgent } from "~/lib/server/infrastructure/gateways/chat/chat-agent-runner-gateway";
import {
  createChatConversationSession,
} from "~/lib/server/infrastructure/gateways/chat/chat-session-gateway";
import { buildSystemInstructionContextPayload } from "~/lib/server/infrastructure/gateways/chat/system-instruction-context";
import {
  buildMcpConnectParams,
  buildMcpConnectSuccessResponse,
  buildThreadOperationLogRequestId,
  createMcpServerSession,
} from "~/lib/server/infrastructure/gateways/mcp/mcp-session-logging";
import {
  acquireThreadMcpServerSession,
  type ThreadMcpServerSession,
} from "~/lib/server/infrastructure/gateways/mcp/thread-mcp-server-session-pool";
import {
  buildSkillRuntimeContext,
  collectSkillRuntimeWarnings,
} from "~/lib/server/infrastructure/gateways/skills/chat-skill-runtime";
import {
  buildSkillTools,
} from "~/lib/server/infrastructure/gateways/skills/chat-skill-tools";
import {
  emitSkillActivationOperationLogs,
} from "~/lib/server/infrastructure/gateways/skills/skill-operation-records";
import type { ClientMcpServerConfig } from "~/lib/server/usecase/chat/mcp-server-config-types";
import { cleanupChatRuntime } from "~/lib/server/usecase/chat/chat-runtime-cleanup";
import { prepareMcpRuntime } from "~/lib/server/usecase/chat/chat-mcp-runtime";
import { prepareSkillRuntime } from "~/lib/server/usecase/chat/chat-skill-runtime-preparation";
import { buildAgentInstructionWithSkills } from "~/lib/server/usecase/chat/skill-instruction-builder";
import {
  buildMcpServerSessionConfigKey,
} from "~/lib/server/usecase/chat/mcp-server-config-normalization";
import type { ChatExecutionPorts } from "~/lib/server/usecase/chat/chat-execution-ports";

export async function getAzureMcpAuthorizationToken(
  scope: string,
  tenantId: string,
): Promise<string> {
  try {
    return await getAzureBearerTokenForScope(scope, tenantId);
  } catch {
    throw new Error(
      `Azure credential failed to acquire token for MCP Authorization header (scope: ${scope}). Run Azure Login and try again.`,
    );
  }
}

export function describeMcpServer(config: ClientMcpServerConfig): string {
  if (config.transport === "stdio") {
    const argsPart = config.args.length > 0 ? ` ${config.args.join(" ")}` : "";
    return `stdio:${config.command}${argsPart}`;
  }

  return config.useAzureAuth
    ? `${config.url} (azure auth: ${config.azureAuthScope}, timeout: ${config.timeoutSeconds}s)`
    : `${config.url} (timeout: ${config.timeoutSeconds}s)`;
}

export const chatExecutionDependencies: ChatExecutionPorts = {
  prepareMcpRuntime,
  acquireThreadMcpServerSession: async (options) =>
    acquireThreadMcpServerSession({
      threadId: options.threadId,
      sessionKey: options.sessionKey,
      refreshState: options.refreshState,
      idleTtlMs: options.idleTtlMs,
      createSession: async (refreshState) =>
        (await options.createSession()) as ThreadMcpServerSession<
          typeof refreshState
        >,
    }),
  buildThreadOperationLogRequestId,
  buildMcpConnectParams,
  buildMcpServerSessionConfigKey,
  getAzureMcpAuthorizationToken,
  createMcpServerSession,
  buildMcpConnectSuccessResponse,
  describeMcpServer,
  prepareSkillRuntime,
  buildSkillRuntimeContext,
  emitSkillActivationOperationLogs,
  collectSkillRuntimeWarnings,
  buildSystemInstructionContextPayload,
  buildSkillTools,
  buildAgentInstructionWithSkills,
  createConversationSession: createChatConversationSession,
  runChatAgent,
  cleanupChatRuntime,
  createCodeInterpreterContainerWithAttachments,
  deleteCodeInterpreterContainer,
};
