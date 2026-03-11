import {
  MCPServerSSE,
  MCPServerStdio,
  MCPServerStreamableHttp,
  type MCPServer,
} from "@openai/agents";
import type {
  ClientMcpServerConfig,
} from "~/lib/server/usecase/chat/mcp-server-config-types";
import {
  buildStdioSpawnEnvironment,
  resolveExecutableInvocation,
} from "~/lib/server/infrastructure/gateways/chat/stdio-runtime-path";
import {
  buildMcpHttpRuntimeHeaders,
  fetchWithMcpMetaNormalization,
  type McpRequestContext,
} from "~/lib/server/infrastructure/gateways/mcp/mcp-http-session-helpers";
import type {
  ThreadMcpServerSession,
} from "~/lib/server/infrastructure/gateways/mcp/thread-mcp-server-session-pool";

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

export type InstrumentMcpServerHandlers = {
  nextSequence: () => number;
  onRecord: (record: ThreadOperationLogRecord) => void;
};

export type McpServerSessionRefreshState = {
  requestContext: McpRequestContext;
  getAzureAuthorizationToken: (scope: string) => Promise<string>;
  logHandlers: InstrumentMcpServerHandlers;
};

type InstrumentedMcpServerState = {
  handlers: InstrumentMcpServerHandlers;
  resetListToolsCache: () => void;
};

const instrumentedMcpServerStateSymbol = Symbol(
  "local-playground.instrumented-mcp-server-state",
);

export function buildMcpConnectSuccessResponse(
  requestId: string,
  status: "connected" | "reused",
): JsonRpcResponsePayload {
  return {
    jsonrpc: "2.0",
    id: requestId,
    result: {
      status,
    },
  };
}

export async function createMcpServerSession(
  config: ClientMcpServerConfig,
): Promise<ThreadMcpServerSession<McpServerSessionRefreshState>> {
  if (config.transport === "stdio") {
    const env = buildStdioSpawnEnvironment(config.env);
    const invocation = resolveExecutableInvocation(config.command, config.args, env);
    const server = new MCPServerStdio({
      name: config.name,
      command: invocation.command,
      args: invocation.args,
      cwd: config.cwd,
      env,
    });
    return {
      server,
      refreshBeforeUse: async (refreshState) => {
        instrumentMcpServer(server, refreshState.logHandlers);
      },
    };
  }

  const requestInit: RequestInit = {
    headers: {},
  };
  const server =
    config.transport === "sse"
      ? new MCPServerSSE({
          name: config.name,
          url: config.url,
          clientSessionTimeoutSeconds: config.timeoutSeconds,
          timeout: config.timeoutSeconds * 1000,
          fetch: fetchWithMcpMetaNormalization,
          requestInit,
        })
      : new MCPServerStreamableHttp({
          name: config.name,
          url: config.url,
          clientSessionTimeoutSeconds: config.timeoutSeconds,
          timeout: config.timeoutSeconds * 1000,
          fetch: fetchWithMcpMetaNormalization,
          requestInit,
        });
  return {
    server,
    refreshBeforeUse: async (refreshState) => {
      instrumentMcpServer(server, refreshState.logHandlers);
      const headers = await buildMcpHttpRuntimeHeaders(config, refreshState);
      requestInit.headers = headers;
    },
  };
}

export function instrumentMcpServer(
  server: MCPServer,
  handlers: InstrumentMcpServerHandlers,
): MCPServer {
  const instrumentedServer = server as MCPServer & {
    [instrumentedMcpServerStateSymbol]?: InstrumentedMcpServerState;
  };
  const existingState = instrumentedServer[instrumentedMcpServerStateSymbol];
  if (existingState) {
    existingState.handlers = handlers;
    return server;
  }

  const originalListTools = server.listTools.bind(server);
  const originalCallTool = server.callTool.bind(server);
  const originalInvalidateToolsCache = server.invalidateToolsCache.bind(server);
  let hasCachedListToolsResult = false;
  let cachedListToolsResult: Awaited<
    ReturnType<typeof originalListTools>
  > | null = null;
  let pendingListToolsResult: Promise<
    Awaited<ReturnType<typeof originalListTools>>
  > | null = null;
  const state: InstrumentedMcpServerState = {
    handlers,
    resetListToolsCache: () => {
      hasCachedListToolsResult = false;
      cachedListToolsResult = null;
      pendingListToolsResult = null;
    },
  };
  instrumentedServer[instrumentedMcpServerStateSymbol] = state;

  server.listTools = async () => {
    if (hasCachedListToolsResult && cachedListToolsResult !== null) {
      return cachedListToolsResult;
    }
    if (pendingListToolsResult) {
      return pendingListToolsResult;
    }

    const sequence = state.handlers.nextSequence();
    const requestId = buildThreadOperationLogRequestId(server.name, sequence);
    const startedAt = new Date().toISOString();
    const requestPayload: JsonRpcRequestPayload = {
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/list",
      params: {},
    };

    const requestPromise = (async () => {
      try {
        const result = await originalListTools();
        const responsePayload: JsonRpcResponsePayload = {
          jsonrpc: "2.0",
          id: requestId,
          result: {
            tools: toSerializableValue(result),
          },
        };

        state.handlers.onRecord({
          id: requestId,
          sequence,
          operationType: "mcp",
          serverName: server.name,
          method: "tools/list",
          startedAt,
          completedAt: new Date().toISOString(),
          request: requestPayload,
          response: responsePayload,
          isError: false,
        });

        cachedListToolsResult = result;
        hasCachedListToolsResult = true;
        return result;
      } catch (error) {
        const responsePayload: JsonRpcResponsePayload = {
          jsonrpc: "2.0",
          id: requestId,
          error: {
            message: readErrorMessage(error),
          },
        };

        state.handlers.onRecord({
          id: requestId,
          sequence,
          operationType: "mcp",
          serverName: server.name,
          method: "tools/list",
          startedAt,
          completedAt: new Date().toISOString(),
          request: requestPayload,
          response: responsePayload,
          isError: true,
        });

        throw error;
      } finally {
        pendingListToolsResult = null;
      }
    })();

    pendingListToolsResult = requestPromise;
    return requestPromise;
  };

  server.invalidateToolsCache = () => {
    state.resetListToolsCache();
    return originalInvalidateToolsCache();
  };

  server.callTool = async (toolName, args, meta) => {
    const sequence = state.handlers.nextSequence();
    const requestId = buildThreadOperationLogRequestId(server.name, sequence);
    const startedAt = new Date().toISOString();
    const requestPayload: JsonRpcRequestPayload = {
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: toSerializableValue(args ?? {}),
        ...(meta ? { _meta: toSerializableValue(meta) } : {}),
      },
    };

    try {
      const result = await originalCallTool(toolName, args, meta);
      const responsePayload: JsonRpcResponsePayload = {
        jsonrpc: "2.0",
        id: requestId,
        result: toSerializableValue(result),
      };

      state.handlers.onRecord({
        id: requestId,
        sequence,
        operationType: "mcp",
        serverName: server.name,
        method: "tools/call",
        startedAt,
        completedAt: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        isError: false,
      });

      return result;
    } catch (error) {
      const responsePayload: JsonRpcResponsePayload = {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          message: readErrorMessage(error),
        },
      };

      state.handlers.onRecord({
        id: requestId,
        sequence,
        operationType: "mcp",
        serverName: server.name,
        method: "tools/call",
        startedAt,
        completedAt: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        isError: true,
      });

      throw error;
    }
  };

  return server;
}

export function buildThreadOperationLogRequestId(
  serverName: string,
  sequence: number,
): string {
  const normalizedName =
    serverName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-") || "mcp";
  return `${normalizedName}-${Date.now()}-${sequence}`;
}

export function buildMcpConnectParams(
  serverConfig: ClientMcpServerConfig,
): Record<string, unknown> {
  if (serverConfig.transport === "stdio") {
    return {
      transport: "stdio",
      command: serverConfig.command,
      args: serverConfig.args,
      cwd: serverConfig.cwd ?? "",
      envKeys: Object.keys(serverConfig.env).sort((left, right) =>
        left.localeCompare(right),
      ),
      env: toSerializableValue(serverConfig.env),
    };
  }

  return {
    transport: serverConfig.transport,
    url: serverConfig.url,
    headerKeys: Object.keys(serverConfig.headers).sort((left, right) =>
      left.localeCompare(right),
    ),
    useAzureAuth: serverConfig.useAzureAuth,
    azureAuthScope: serverConfig.azureAuthScope,
    timeoutSeconds: serverConfig.timeoutSeconds,
  };
}

function toSerializableValue(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
