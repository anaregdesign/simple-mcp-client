import { AZURE_COGNITIVE_SERVICES_SCOPE } from "~/lib/constants/azure";

/**
 * Impact scope:
 * These constants define MCP server validation, parsing, and display behavior.
 * Changing them affects both API-side payload validation and client-side form checks.
 */
export const MCP_SERVER_NAME_MAX_LENGTH = 80;
export const MCP_STDIO_ARGS_MAX = 64;
export const MCP_STDIO_ENV_VARS_MAX = 64;
export const MCP_HTTP_HEADERS_MAX = 64;
export const MCP_AZURE_AUTH_SCOPE_MAX_LENGTH = 512;
export const MCP_TIMEOUT_SECONDS_MIN = 1;
export const MCP_TIMEOUT_SECONDS_MAX = 600;
export const MCP_DEFAULT_TIMEOUT_SECONDS = 30;
export const THREAD_MCP_SERVER_SESSION_IDLE_TTL_MS = 5 * 60_000;
export const MCP_DEFAULT_AZURE_AUTH_SCOPE = AZURE_COGNITIVE_SERVICES_SCOPE;
export const MCP_DEFAULT_HTTP_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
};
export const MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER = "X-Local-Playground-Thread-Id";
export const MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER = "X-Local-Playground-Turn-Id";
export const MCP_LOCAL_PLAYGROUND_CLIENT_USER_AGENT_HEADER = "X-Local-Playground-Client-User-Agent";
export const MCP_LOCAL_PLAYGROUND_CLIENT_PLATFORM_HEADER = "X-Local-Playground-Client-Platform";
export const MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES = [
  "@modelcontextprotocol/server-git",
  "@modelcontextprotocol/server-http",
  "@modelcontextprotocol/server-sqlite",
  "@modelcontextprotocol/server-postgres",
  "@modelcontextprotocol/server-shell",
  "@modelcontextprotocol/server-playwright",
] as const;

type HomeDefaultWorkspaceMcpServerProfileHttpRow = {
  name: string;
  transport: "streamable_http" | "sse";
  url: string;
  headers: Record<string, string>;
  useAzureAuth: boolean;
  azureAuthScope: string;
  timeoutSeconds: number;
  connectOnThreadCreate: boolean;
};

type HomeDefaultWorkspaceMcpServerProfileStdioRow = {
  name: string;
  transport: "stdio";
  command: string;
  args: readonly string[];
  cwd: "default" | null;
  env: Record<string, string>;
  connectOnThreadCreate: boolean;
};

export type HomeDefaultWorkspaceMcpServerProfileRow =
  | HomeDefaultWorkspaceMcpServerProfileHttpRow
  | HomeDefaultWorkspaceMcpServerProfileStdioRow;

export const HOME_DEFAULT_MCP_TRANSPORT = "streamable_http" as const;
export const HOME_DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS = [
  {
    name: "openai-docs",
    transport: "streamable_http",
    url: "https://developers.openai.com/mcp",
    headers: {},
    useAzureAuth: false,
    azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
    timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
    connectOnThreadCreate: false,
  },
  {
    name: "microsoft-learn",
    transport: "streamable_http",
    url: "https://learn.microsoft.com/api/mcp",
    headers: {},
    useAzureAuth: false,
    azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
    timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
    connectOnThreadCreate: false,
  },
  {
    name: "cmd",
    transport: "streamable_http",
    url: "/mcp/cmd",
    headers: {},
    useAzureAuth: false,
    azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
    timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
    connectOnThreadCreate: true,
  },
  {
    name: "filesystem",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    cwd: "default",
    env: {},
    connectOnThreadCreate: false,
  },
  {
    name: "workiq",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@microsoft/workiq", "mcp"],
    cwd: "default",
    env: {},
    connectOnThreadCreate: false,
  },
  {
    name: "server-memory",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    cwd: null,
    env: {},
    connectOnThreadCreate: false,
  },
  {
    name: "server-everything",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-everything"],
    cwd: null,
    env: {},
    connectOnThreadCreate: false,
  },
  {
    name: "azure-mcp",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@azure/mcp@latest", "server", "start"],
    cwd: null,
    env: {},
    connectOnThreadCreate: false,
  },
  {
    name: "playwright",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    cwd: null,
    env: {},
    connectOnThreadCreate: false,
  },
  {
    name: "drawio",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@drawio/mcp@latest"],
    cwd: "default",
    env: {},
    connectOnThreadCreate: false,
  },
  {
    name: "mcp-mermaid",
    transport: "stdio",
    command: "npx",
    args: ["-y", "mcp-mermaid"],
    cwd: "default",
    env: {},
    connectOnThreadCreate: false,
  },
] as const satisfies readonly HomeDefaultWorkspaceMcpServerProfileRow[];

export const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
