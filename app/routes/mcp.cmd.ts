/**
 * MCP route module for /mcp/cmd shell command server.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import * as z from "zod/v4";
import {
  MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER,
  MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER,
} from "~/lib/constants/mcp";
import { readAzureArmUserContext } from "~/lib/server/infrastructure/auth/azure-arm-user-context";
import { NodeMcpCmdShellGateway } from "~/lib/server/infrastructure/gateways/mcp/mcp-cmd-shell-gateway";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import { getOrCreateUserByIdentity } from "~/lib/server/infrastructure/persistence/user";
import { resolveWorkingDirectory } from "~/lib/server/infrastructure/gateways/mcp/mcp-cmd-working-directory";
import {
  MCP_CMD_DEFAULT_TIMEOUT_SECONDS,
  MCP_CMD_MAX_COMMAND_LENGTH,
  MCP_CMD_MAX_TIMEOUT_SECONDS,
  McpCmdService,
  type McpCmdToolContext,
  type McpCmdToolPayload,
} from "~/lib/server/usecase/mcp/mcp-cmd-service";

const MCP_CMD_ROUTE_PATH = "/mcp/cmd";
const MCP_CMD_AUTH_REQUIRED_MESSAGE =
  "Authentication required. Click Azure Login in Settings and try again.";
const MCP_CMD_TOOL_NAME = "shell_execute_command";
const MCP_CMD_TOOL_DESCRIPTION = [
  "Executes an arbitrary shell command on the Local Playground host.",
  "Returns stdout/stderr, exit status, timeout state, execution duration, and resolved shell metadata.",
  "Security policy: critical destructive command patterns are blocked.",
  "Security policy: sensitive credential/system path references are blocked.",
  "Security policy: command environment is sanitized and scoped to the thread directory.",
  "Default working directory is the workspace thread directory under the Local Playground storage root.",
  "threadContext.threadId is required for secure command execution.",
].join("\n");

const cmdExecuteInputSchema = {
  threadId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional thread identifier supplied by the client. When provided, this value is used for default working directory resolution.",
    ),
  command: z
    .string()
    .min(1)
    .max(MCP_CMD_MAX_COMMAND_LENGTH)
    .describe(
      "Shell command to execute in the selected shell environment (for example: `ls -la`, `npm run test`, `git status`).",
    ),
  workingDirectory: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional working directory. Relative paths are resolved from the Local Playground process current directory. When omitted, uses the workspace thread directory under the Local Playground storage root.",
    ),
  timeoutSeconds: z
    .number()
    .int()
    .min(1)
    .max(MCP_CMD_MAX_TIMEOUT_SECONDS)
    .optional()
    .describe(
      `Execution timeout in seconds. Defaults to ${MCP_CMD_DEFAULT_TIMEOUT_SECONDS} (max ${MCP_CMD_MAX_TIMEOUT_SECONDS}).`,
    ),
};

type AuthenticatedMcpCmdContext = {
  userId: number;
  tenantId: string;
  principalId: string;
};

type McpCmdRequestContext = AuthenticatedMcpCmdContext & {
  threadId: string | null;
  turnId: string | null;
};

export async function loader({ request }: { request: Request }) {
  installGlobalServerErrorLogging();
  return handleMcpRequest(request);
}

export async function action({ request }: { request: Request }) {
  installGlobalServerErrorLogging();
  return handleMcpRequest(request);
}

async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonRpcErrorResponse(
      405,
      -32000,
      `Method not allowed. Use POST ${MCP_CMD_ROUTE_PATH}.`,
    );
  }

  const authenticatedContext = await readAuthenticatedMcpCmdContext();
  if (!authenticatedContext) {
    return jsonRpcErrorResponse(401, -32001, MCP_CMD_AUTH_REQUIRED_MESSAGE);
  }

  const requestContext = readMcpCmdRequestContext(
    request,
    authenticatedContext,
  );
  const server = createCmdMcpServer(requestContext);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: MCP_CMD_ROUTE_PATH,
      eventName: "mcp_cmd_route_failed",
      action: "handle_mcp_request",
      statusCode: 500,
      error,
      userId: requestContext.userId,
      threadId: requestContext.threadId,
      context: {
        tenantId: requestContext.tenantId,
        principalId: requestContext.principalId,
        turnId: requestContext.turnId,
      },
    });

    return jsonRpcErrorResponse(500, -32603, "Internal server error.");
  } finally {
    await Promise.allSettled([transport.close(), server.close()]);
  }
}

function createCmdMcpServer(requestContext: McpCmdRequestContext): McpServer {
  const server = new McpServer({
    name: "local-playground-cmd",
    version: "1.0.0",
  });
  const service = createMcpCmdService();

  server.registerTool(
    MCP_CMD_TOOL_NAME,
    {
      description: MCP_CMD_TOOL_DESCRIPTION,
      inputSchema: cmdExecuteInputSchema,
    },
    async (args) => {
      const result = await service.executeTool(
        readToolContext(requestContext),
        args,
      );
      return buildToolResponse(result.payload, { isError: result.isError });
    },
  );

  return server;
}

function createMcpCmdService(): McpCmdService {
  return new McpCmdService({
    resolveWorkingDirectory,
    shellGateway: new NodeMcpCmdShellGateway(),
  });
}

function readToolContext(
  requestContext: McpCmdRequestContext,
): McpCmdToolContext {
  return {
    userId: requestContext.userId,
    threadId: requestContext.threadId,
    turnId: requestContext.turnId,
  };
}

function readMcpCmdRequestContext(
  request: Request,
  authenticatedContext: AuthenticatedMcpCmdContext,
): McpCmdRequestContext {
  return {
    ...authenticatedContext,
    threadId: readOptionalHeaderValue(
      request,
      MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER,
    ),
    turnId: readOptionalHeaderValue(
      request,
      MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER,
    ),
  };
}

async function readAuthenticatedMcpCmdContext(): Promise<AuthenticatedMcpCmdContext | null> {
  const azureContext = await readAzureArmUserContext();
  if (!azureContext) {
    return null;
  }

  const user = await getOrCreateUserByIdentity({
    tenantId: azureContext.tenantId,
    principalId: azureContext.principalId,
  });

  return {
    userId: user.id,
    tenantId: azureContext.tenantId,
    principalId: azureContext.principalId,
  };
}

function readOptionalHeaderValue(
  request: Request,
  headerName: string,
): string | null {
  const raw = request.headers.get(headerName);
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

function jsonRpcErrorResponse(
  status: number,
  code: number,
  message: string,
): Response {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: {
        code,
        message,
      },
      id: null,
    },
    { status },
  );
}

function buildToolResponse(
  payload: McpCmdToolPayload,
  options: {
    isError?: boolean;
    text?: string;
  } = {},
) {
  const text =
    typeof options.text === "string"
      ? options.text
      : JSON.stringify(payload, null, 2);
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
    structuredContent: payload,
    ...(options.isError ? { isError: true } : {}),
  };
}
