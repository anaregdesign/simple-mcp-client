import {
  CHAT_MODEL_RUN_TIMEOUT_MS,
  CHAT_MAX_RUN_TURNS,
} from "~/lib/constants/chat";
import type {
  ChatExecutionOptions,
  ChatExecutionPorts,
  ChatExecutionResult,
  ChatProgressEvent,
  SkillToolExecutionContext,
} from "~/lib/server/usecase/chat/chat-execution-ports";
import type {
  SkillRuntimeContext,
} from "~/lib/server/usecase/chat/skill-runtime-types";

export async function runChatAgentExecution(options: {
  execution: ChatExecutionOptions;
  dependencies: Pick<
    ChatExecutionPorts,
    | "buildAgentInstructionWithSkills"
    | "createConversationSession"
    | "runChatAgent"
  >;
  connectedMcpServers: unknown[];
  skillRuntime: SkillRuntimeContext;
  skillTools: unknown[];
  implicitSystemInstructionContext: Awaited<
    ReturnType<ChatExecutionPorts["buildSystemInstructionContextPayload"]>
  >;
  enableCodeInterpreterTool: boolean;
  codeInterpreterContainerId: string;
  hasMcpServers: boolean;
  abortSignal?: AbortSignal;
  onProgressEvent?: (event: ChatProgressEvent) => void;
}): Promise<{
  runResult: Awaited<ReturnType<ChatExecutionPorts["runChatAgent"]>>;
  conversationSession: ReturnType<ChatExecutionPorts["createConversationSession"]>;
}> {
  const {
    execution,
    dependencies,
    connectedMcpServers,
    skillRuntime,
    skillTools,
    implicitSystemInstructionContext,
    enableCodeInterpreterTool,
    codeInterpreterContainerId,
    hasMcpServers,
    abortSignal,
    onProgressEvent,
  } = options;
  const conversationSession = dependencies.createConversationSession({
    sessionId: execution.agentConversationId,
    history: execution.history,
    useCodeInterpreter: enableCodeInterpreterTool,
  });
  const runTimeoutSeconds = Math.ceil(CHAT_MODEL_RUN_TIMEOUT_MS / 1000);
  const runTimeoutMessage = enableCodeInterpreterTool
    ? `Azure OpenAI request timed out after ${runTimeoutSeconds} seconds while processing file attachments. The selected deployment may not support Code Interpreter.`
    : `Azure OpenAI request timed out after ${runTimeoutSeconds} seconds.`;
  const runResult = await dependencies.runChatAgent({
    azureConfig: execution.azureConfig,
    webSearchEnabled: execution.webSearchEnabled,
    webSearchUserLocation: execution.webSearchUserLocation,
    enableCodeInterpreterTool,
    codeInterpreterContainerId,
    connectedMcpServers,
    skillTools,
    agentInstruction: dependencies.buildAgentInstructionWithSkills(
      execution.agentInstruction,
      skillRuntime,
      {
        instructionContextToggles: execution.instructionContextToggles,
        systemInstructionContext: implicitSystemInstructionContext,
      },
    ),
    reasoningEffort: execution.reasoningEffort,
    temperature: execution.temperature,
    conversationSession,
    message: execution.message,
    attachments: execution.attachments,
    hasMcpServers,
    maxTurns: CHAT_MAX_RUN_TURNS,
    runTimeoutMs: CHAT_MODEL_RUN_TIMEOUT_MS,
    runTimeoutMessage,
    abortSignal,
    ...(onProgressEvent ? { onProgressEvent } : {}),
  });

  return {
    runResult,
    conversationSession,
  };
}
