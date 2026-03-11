export type McpHttpServerConfig = {
  id: string;
  name: string;
  connectOnThreadCreate?: boolean;
  transport: "streamable_http" | "sse";
  url: string;
  headers: Record<string, string>;
  useAzureAuth: boolean;
  azureAuthScope: string;
  timeoutSeconds: number;
};

export type McpStdioServerConfig = {
  id: string;
  name: string;
  connectOnThreadCreate?: boolean;
  transport: "stdio";
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
};

export type McpServerConfig = McpHttpServerConfig | McpStdioServerConfig;

export type IncomingMcpHttpServerConfig = Omit<McpHttpServerConfig, "id"> & {
  id?: string;
};

export type IncomingMcpStdioServerConfig = Omit<McpStdioServerConfig, "id"> & {
  id?: string;
};

export type IncomingMcpServerConfig =
  | IncomingMcpHttpServerConfig
  | IncomingMcpStdioServerConfig;
