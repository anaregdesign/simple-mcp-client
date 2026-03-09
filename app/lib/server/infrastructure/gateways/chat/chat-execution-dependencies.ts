import {
  createCodeInterpreterContainerWithAttachments,
} from "~/lib/server/infrastructure/gateways/chat/code-interpreter-attachment-gateway";
import {
  getAzureBearerTokenForScope,
  createAzureOpenAIClient,
} from "~/lib/server/infrastructure/gateways/azure/azure-openai-gateway";
import {
  readProgressEventFromRunStreamEvent,
} from "~/lib/server/infrastructure/gateways/chat/run-stream-progress";
import { buildSystemInstructionContextPayload } from "~/lib/server/infrastructure/gateways/chat/system-instruction-context";
import {
  buildMcpConnectParams,
  buildMcpConnectSuccessResponse,
  buildThreadOperationLogRequestId,
  createMcpServerSession,
} from "~/lib/server/infrastructure/gateways/mcp/mcp-session-logging";
import {
  acquireThreadMcpServerSession,
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
import type { ClientMcpServerConfig } from "~/lib/server/infrastructure/gateways/chat/request-parser";
import { cleanupChatRuntime } from "~/lib/server/usecase/chat/chat-runtime-cleanup";
import { prepareMcpRuntime } from "~/lib/server/usecase/chat/chat-mcp-runtime";
import { buildAgentRunContext } from "~/lib/server/usecase/chat/agent-run-context";
import { prepareSkillRuntime } from "~/lib/server/usecase/chat/chat-skill-runtime-preparation";
import { buildAgentInstructionWithSkills } from "~/lib/server/usecase/chat/skill-instruction-builder";
import {
  buildMcpServerSessionConfigKey,
} from "~/lib/server/usecase/chat/mcp-server-config-normalization";
import type { ChatExecutionDependencies } from "~/lib/server/usecase/chat/chat-execution";

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

export const chatExecutionDependencies: ChatExecutionDependencies = {
  createAzureOpenAIClient,
  prepareMcpRuntime,
  acquireThreadMcpServerSession,
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
  buildAgentRunContext,
  readProgressEventFromRunStreamEvent,
  cleanupChatRuntime,
  createCodeInterpreterContainerWithAttachments,
};
