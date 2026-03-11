import type {
  IncomingMcpHttpServerConfig,
  IncomingMcpStdioServerConfig,
  McpHttpServerConfig,
  McpStdioServerConfig,
} from "~/lib/domain/value-objects/mcp-server-config";

type McpServerConfigKeySharedInput = {
  id?: string;
  name?: string;
  connectOnThreadCreate?: boolean;
};

type McpServerConfigKeyHttpInput = McpServerConfigKeySharedInput &
  Pick<
  McpHttpServerConfig | IncomingMcpHttpServerConfig,
  | "transport"
  | "url"
  | "headers"
  | "useAzureAuth"
  | "azureAuthScope"
  | "timeoutSeconds"
>;

type McpServerConfigKeyStdioInput = McpServerConfigKeySharedInput &
  Pick<
  McpStdioServerConfig | IncomingMcpStdioServerConfig,
  "transport" | "command" | "args" | "cwd" | "env"
>;

export type McpServerConfigKeyInput =
  | McpServerConfigKeyHttpInput
  | McpServerConfigKeyStdioInput;

export function buildMcpServerConfigKey(config: McpServerConfigKeyInput): string {
  if (config.transport === "stdio") {
    const envKey = Object.entries(config.env)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("\u0000");
    return `${config.transport}:${config.command.toLowerCase()}:${config.args.join("\u0000")}:${(config.cwd ?? "").toLowerCase()}:${envKey}`;
  }

  const headersKey = Object.entries(config.headers)
    .map(([key, value]) => [key.toLowerCase(), value] as const)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\u0000");
  const authKey = config.useAzureAuth ? "azure-auth:on" : "azure-auth:off";
  const scopeKey = config.useAzureAuth ? config.azureAuthScope.toLowerCase() : "";
  return `${config.transport}:${config.url.toLowerCase()}:${headersKey}:${authKey}:${scopeKey}:${config.timeoutSeconds}`;
}
