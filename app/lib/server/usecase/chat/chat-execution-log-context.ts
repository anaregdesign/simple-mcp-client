import type { ThreadEnvironment } from "~/lib/domain/value-objects/thread-environment";
import type {
  ChatExecutionOptions,
  ChatMcpRuntimeMetrics,
} from "~/lib/server/usecase/chat/chat-execution";

export type ChatExecutionSuccessLogResult = {
  message: string;
  threadEnvironment: ThreadEnvironment;
  operationLogCount: number;
  mcpRuntimeMetrics: ChatMcpRuntimeMetrics;
};

export function buildChatExecutionLogContext(
  options: ChatExecutionOptions,
): Record<string, unknown> {
  return {
    turnId: options.turnId,
    tenantId: options.azureConfig.tenantId,
    deploymentName: options.azureConfig.deploymentName,
    messageLength: options.message.length,
    historyCount: options.history.length,
    attachmentCount: options.attachments.length,
    threadEnvironmentKeyCount: Object.keys(options.threadEnvironment).length,
    reasoningEffort: options.reasoningEffort,
    webSearchEnabled: options.webSearchEnabled,
    webSearchUserLocationCountry:
      options.webSearchUserLocation?.country ?? null,
    systemInstructionContextEnabled: options.instructionContextToggles.system,
    mcpServerCount: options.mcpServers.length,
    skillCount: options.skills.length,
    explicitSkillLocationCount: options.explicitSkillLocations.length,
  };
}

export function buildChatExecutionSuccessLogContext(
  options: ChatExecutionOptions,
  result: ChatExecutionSuccessLogResult,
): Record<string, unknown> {
  return {
    ...buildChatExecutionLogContext(options),
    responseLength: result.message.length,
    operationLogCount: result.operationLogCount,
    ...result.mcpRuntimeMetrics,
  };
}
