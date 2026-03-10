import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { ThreadEnvironment } from "~/lib/domain/value-objects/thread-environment";
import type { ThreadInstructionContextToggles } from "~/lib/domain/value-objects/thread-instruction-context";
import type { ClientMcpServerConfig } from "~/lib/server/usecase/chat/mcp-server-config-types";
import type {
  ActiveSkillRuntimeEntry,
  SkillRuntimeContext,
} from "~/lib/server/usecase/chat/skill-runtime-types";

type ThreadMessageRole = "user" | "assistant";

export type ClientAttachment = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

export type ClientMessage = {
  role: ThreadMessageRole;
  content: string;
  attachments: ClientAttachment[];
};

export type ClientSkillSelection = ThreadSkillActivation;

export type ResolvedAzureConfig = {
  tenantId: string;
  projectName: string;
  baseUrl: string;
  apiVersion: string;
  deploymentName: string;
};

export type WebSearchPreviewUserLocation = {
  city?: string;
  country?: string;
  region?: string;
  timezone?: string;
};

export type ChatExecutionOptions = {
  threadId: string | null;
  turnId: string | null;
  userId: number | null;
  clientUserAgent: string | null;
  clientPlatform: string | null;
  message: string;
  attachments: ClientAttachment[];
  history: ClientMessage[];
  reasoningEffort: ReasoningEffort | null;
  webSearchEnabled: boolean;
  webSearchUserLocation: WebSearchPreviewUserLocation | null;
  temperature: number | null;
  agentInstruction: string;
  instructionContextToggles: ThreadInstructionContextToggles;
  threadEnvironment: ThreadEnvironment;
  skills: ClientSkillSelection[];
  explicitSkillLocations: string[];
  azureConfig: ResolvedAzureConfig;
  agentConversationId: string | null;
  mcpServers: ClientMcpServerConfig[];
};

export type JsonRpcRequestPayload = {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params: Record<string, unknown>;
};

export type JsonRpcResponsePayload =
  | {
      jsonrpc: "2.0";
      id: string;
      result: unknown;
    }
  | {
      jsonrpc: "2.0";
      id: string;
      error: {
        message: string;
      };
    };

export type ThreadOperationLogRecord = {
  id: string;
  sequence: number;
  operationType: "mcp" | "skill";
  serverName: string;
  method: string;
  startedAt: string;
  completedAt: string;
  request: JsonRpcRequestPayload;
  response: JsonRpcResponsePayload;
  isError: boolean;
};

export type ChatExecutionEvent =
  | {
      type: "progress";
      message: string;
      isMcp?: boolean;
    }
  | {
      type: "operation_log";
      record: ThreadOperationLogRecord;
    };

export type ChatProgressEvent = {
  message: string;
  isMcp?: boolean;
};

export type McpRequestContext = {
  threadId: string | null;
  turnId: string | null;
  clientUserAgent: string | null;
  clientPlatform: string | null;
};

export type ChatMcpRuntimeMetrics = {
  mcpConnectedCount: number;
  mcpReusedCount: number;
  mcpEphemeralConnectCount: number;
  mcpConnectDurationMs: number;
  mcpSetupDurationMs: number;
};

export type McpServerSessionRefreshState = {
  requestContext: McpRequestContext;
  getAzureAuthorizationToken: (scope: string) => Promise<string>;
  logHandlers: {
    nextSequence: () => number;
    onRecord: (record: ThreadOperationLogRecord) => void;
  };
};

export type ChatExecutionResult = {
  message: string;
  threadEnvironment: ThreadEnvironment;
  operationLogCount: number;
  mcpRuntimeMetrics: ChatMcpRuntimeMetrics;
  agentConversationId: string;
};

type InstructionClientOperatingSystemContext = {
  name: string;
  version: string | null;
  source: "sec-ch-ua-platform" | "user-agent" | "unknown";
};

type InstructionServerOperatingSystemContext = {
  name: string;
  platform: NodeJS.Platform;
  release: string;
  architecture: string;
};

export type InstructionSystemContextPayload = {
  userContext: {
    userId: number | null;
    workspaceDirectoryPath: string | null;
  };
  threadContext: {
    threadId: string | null;
    turnId: string | null;
  };
  systemContext: {
    clientOperatingSystem: InstructionClientOperatingSystemContext;
    serverOperatingSystem: InstructionServerOperatingSystemContext;
  };
  latestThreadName: string | null;
  azureContext: {
    principalDisplayName: string | null;
    principalName: string | null;
    principalType:
      | "User"
      | "Service Principal"
      | "Managed Identity"
      | "Unknown";
    tenantId: string | null;
    principalId: string | null;
    playgroundProject: string | null;
    playgroundProjectId: string | null;
    playgroundDeployment: string | null;
    endpoint: string | null;
    apiVersion: string | null;
  };
};

export type SkillToolExecutionContext = {
  threadEnvironment: ThreadEnvironment;
};

export type ChatConversationSessionLike = {
  getSessionId: () => Promise<string>;
};

export type ThreadMcpServerSessionLeaseLike = {
  server: unknown;
  status: "connected" | "reused";
  isEphemeral: boolean;
  release: () => Promise<void>;
};

export type ThreadMcpServerSessionLike<TRefreshState> = {
  server: unknown;
  refreshBeforeUse: (refreshState: TRefreshState) => Promise<void>;
};

export type ChatExecutionPorts = {
  prepareMcpRuntime: (options: {
    serverConfigs: ClientMcpServerConfig[];
    connectServer: (serverConfig: ClientMcpServerConfig) => Promise<{
      lease: ThreadMcpServerSessionLeaseLike;
      server: unknown;
      connectDurationMs: number;
    }>;
    releaseLease: (lease: ThreadMcpServerSessionLeaseLike) => Promise<void>;
  }) => Promise<{
    leases: ThreadMcpServerSessionLeaseLike[];
    servers: unknown[];
    metrics: ChatMcpRuntimeMetrics;
  }>;
  acquireThreadMcpServerSession: (options: {
    threadId: string | null;
    sessionKey: string;
    refreshState: McpServerSessionRefreshState;
    idleTtlMs: number;
    createSession: () => Promise<
      ThreadMcpServerSessionLike<McpServerSessionRefreshState>
    >;
  }) => Promise<ThreadMcpServerSessionLeaseLike>;
  buildThreadOperationLogRequestId: (
    serverName: string,
    sequence: number,
  ) => string;
  buildMcpConnectParams: (
    serverConfig: ClientMcpServerConfig,
  ) => Record<string, unknown>;
  buildMcpServerSessionConfigKey: (config: ClientMcpServerConfig) => string;
  getAzureMcpAuthorizationToken: (
    scope: string,
    tenantId: string,
  ) => Promise<string>;
  createMcpServerSession: (
    config: ClientMcpServerConfig,
  ) => Promise<ThreadMcpServerSessionLike<McpServerSessionRefreshState>>;
  buildMcpConnectSuccessResponse: (
    requestId: string,
    status: "connected" | "reused",
  ) => JsonRpcResponsePayload;
  describeMcpServer: (config: ClientMcpServerConfig) => string;
  prepareSkillRuntime: (options: {
    loadRuntime: () => Promise<SkillRuntimeContext>;
    createExecutionContext: (
      runtime: SkillRuntimeContext,
    ) => SkillToolExecutionContext | null;
    emitActivationLogs: (
      runtime: SkillRuntimeContext,
      context: SkillToolExecutionContext,
    ) => void;
    collectWarnings: (runtime: SkillRuntimeContext) => string[];
  }) => Promise<{
    runtime: SkillRuntimeContext;
    executionContext: SkillToolExecutionContext | null;
    warnings: string[];
  }>;
  buildSkillRuntimeContext: (
    selectedSkills: ClientSkillSelection[],
    options: {
      explicitSkillLocations?: string[];
    },
  ) => Promise<SkillRuntimeContext>;
  emitSkillActivationOperationLogs: (
    skillRuntime: SkillRuntimeContext,
    logHandlers: {
      nextSequence: () => number;
      onRecord: (record: ThreadOperationLogRecord) => void;
    },
    skillExecutionContext: SkillToolExecutionContext,
  ) => void;
  collectSkillRuntimeWarnings: (skillRuntime: SkillRuntimeContext) => string[];
  buildSystemInstructionContextPayload: (
    options: ChatExecutionOptions,
  ) => Promise<InstructionSystemContextPayload | null>;
  buildSkillTools: (
    activeSkills: ActiveSkillRuntimeEntry[],
    logHandlers: {
      nextSequence: () => number;
      onRecord: (record: ThreadOperationLogRecord) => void;
    },
    executionContext: SkillToolExecutionContext,
  ) => unknown[];
  buildAgentInstructionWithSkills: (
    agentInstruction: string,
    skillRuntime: SkillRuntimeContext,
    options: {
      instructionContextToggles: ThreadInstructionContextToggles;
      systemInstructionContext: InstructionSystemContextPayload | null;
    },
  ) => string;
  createConversationSession: (options: {
    sessionId?: string | null;
    history: ClientMessage[];
    useCodeInterpreter: boolean;
  }) => ChatConversationSessionLike;
  runChatAgent: (options: {
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
  }) => Promise<{
    assistantMessage: string;
    agentConversationId: string;
  }>;
  cleanupChatRuntime: (options: {
    codeInterpreterContainerId: string;
    deleteCodeInterpreterContainer: (containerId: string) => Promise<void>;
    mcpServerLeases: ThreadMcpServerSessionLeaseLike[];
    awaitWithTimeout: <T>(
      promise: Promise<T>,
      timeoutMs: number,
      timeoutMessage: string,
    ) => Promise<T>;
    cleanupTimeoutMs: number;
  }) => Promise<void>;
  createCodeInterpreterContainerWithAttachments: (options: {
    attachments: ClientAttachment[];
    azureConfig: ResolvedAzureConfig;
  }) => Promise<string>;
  deleteCodeInterpreterContainer: (options: {
    containerId: string;
    azureConfig: ResolvedAzureConfig;
  }) => Promise<void>;
};
