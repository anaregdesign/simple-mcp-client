import { Agent, run, type MCPServer, type Tool } from "@openai/agents";
import {
  OpenAIResponsesModel,
  codeInterpreterTool,
  webSearchTool,
} from "@openai/agents-openai";
import type { Session } from "@openai/agents-core";
import type {
  ChatConversationSessionLike,
  ChatProgressEvent,
  ClientAttachment,
  ResolvedAzureConfig,
  WebSearchPreviewUserLocation,
} from "~/lib/server/usecase/chat/chat-execution-ports";
import {
  createAzureOpenAIClient,
} from "~/lib/server/infrastructure/gateways/azure/azure-openai-gateway";
import {
  createChatUserMessageInput,
} from "~/lib/server/infrastructure/gateways/chat/chat-session-gateway";
import {
  readProgressEventFromRunStreamEvent,
} from "~/lib/server/infrastructure/gateways/chat/run-stream-progress";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

export type ChatAgentRunnerOptions = {
  azureConfig: ResolvedAzureConfig;
  webSearchEnabled: boolean;
  webSearchUserLocation: WebSearchPreviewUserLocation | null;
  enableCodeInterpreterTool: boolean;
  codeInterpreterContainerId: string;
  connectedMcpServers: unknown[];
  skillTools: unknown[];
  agentInstruction: string;
  reasoningEffort: ReasoningEffort | null;
  temperature: number | null;
  conversationSession: ChatConversationSessionLike;
  message: string;
  attachments: ClientAttachment[];
  hasMcpServers: boolean;
  maxTurns: number;
  runTimeoutMs: number;
  runTimeoutMessage: string;
  abortSignal?: AbortSignal;
  onProgressEvent?: (event: ChatProgressEvent) => void;
};

export async function runChatAgent(options: ChatAgentRunnerOptions): Promise<{
  assistantMessage: string;
  agentConversationId: string;
}> {
  const azureOpenAIClient = createAzureOpenAIClient(
    options.azureConfig.baseUrl,
    options.azureConfig.tenantId,
  );
  const model = new OpenAIResponsesModel(
    azureOpenAIClient,
    options.azureConfig.deploymentName,
  );
  const webSearchTools = options.webSearchEnabled
    ? [
        webSearchTool({
          userLocation: options.webSearchUserLocation ?? undefined,
          searchContextSize: "medium",
        }),
      ]
    : [];
  const agent = new Agent({
    name: "LocalPlaygroundAgent",
    instructions: options.agentInstruction,
    model,
    modelSettings: {
      ...(options.temperature !== null
        ? { temperature: options.temperature }
        : {}),
      ...(options.reasoningEffort
        ? { reasoning: { effort: options.reasoningEffort } }
        : {}),
    },
    tools: [
      ...webSearchTools,
      ...(options.enableCodeInterpreterTool
        ? [
            codeInterpreterTool({
              container: options.codeInterpreterContainerId,
            }),
          ]
        : []),
      ...(options.skillTools as Tool<unknown>[]),
    ],
    mcpServers: options.connectedMcpServers as MCPServer[],
  });
  const agentConversationId = await options.conversationSession.getSessionId();
  const currentInput = createChatUserMessageInput(
    options.message,
    options.attachments,
    {
      useCodeInterpreter: options.enableCodeInterpreterTool,
    },
  );

  if (options.onProgressEvent) {
    const toolNameByCallId = new Map<string, string>();
    const streamedResult = await runAgentWithTimeout(
      (signal) =>
        run(agent, [currentInput], {
          stream: true,
          signal,
          maxTurns: options.maxTurns,
          session: options.conversationSession as Session,
        }),
      options.runTimeoutMs,
      options.runTimeoutMessage,
      options.abortSignal,
    );
    for await (const event of streamedResult) {
      const progress = readProgressEventFromRunStreamEvent(
        event,
        options.hasMcpServers,
        toolNameByCallId,
      );
      if (progress) {
        options.onProgressEvent(progress);
      }
    }

    await awaitWithTimeout(
      streamedResult.completed,
      options.runTimeoutMs,
      options.runTimeoutMessage,
    );

    const assistantMessage = extractAgentFinalOutput(
      streamedResult.finalOutput,
    );
    if (!assistantMessage) {
      throw new Error("Azure OpenAI returned an empty message.");
    }

    return {
      assistantMessage,
      agentConversationId,
    };
  }

  const result = await runAgentWithTimeout(
    (signal) =>
      run(agent, [currentInput], {
          signal,
          maxTurns: options.maxTurns,
          session: options.conversationSession as Session,
        }),
    options.runTimeoutMs,
    options.runTimeoutMessage,
    options.abortSignal,
  );
  const assistantMessage = extractAgentFinalOutput(result.finalOutput);
  if (!assistantMessage) {
    throw new Error("Azure OpenAI returned an empty message.");
  }

  return {
    assistantMessage,
    agentConversationId,
  };
}

function extractAgentFinalOutput(finalOutput: unknown): string {
  if (typeof finalOutput === "string") {
    return finalOutput.trim();
  }
  if (typeof finalOutput === "number" || typeof finalOutput === "boolean") {
    return String(finalOutput);
  }
  if (finalOutput && typeof finalOutput === "object") {
    try {
      return JSON.stringify(finalOutput);
    } catch {
      return "";
    }
  }
  return "";
}

async function awaitWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function runAgentWithTimeout<T>(
  runTask: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
  upstreamAbortSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const removeAbortRelay = relayAbortSignal(upstreamAbortSignal, controller);
  try {
    return await awaitWithTimeout(
      runTask(controller.signal),
      timeoutMs,
      timeoutMessage,
    );
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    removeAbortRelay();
  }
}

function relayAbortSignal(
  source: AbortSignal | undefined,
  target: AbortController,
): () => void {
  if (!source) {
    return () => {};
  }

  if (source.aborted) {
    target.abort();
    return () => {};
  }

  const onAbort = () => {
    target.abort();
  };
  source.addEventListener("abort", onAbort);
  return () => {
    source.removeEventListener("abort", onAbort);
  };
}
