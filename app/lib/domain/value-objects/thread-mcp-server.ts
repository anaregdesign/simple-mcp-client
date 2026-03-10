export type ThreadMcpHttpServer = {
  id: string;
  threadId: string;
  selectionOrder: number;
  name: string;
  transport: "streamable_http" | "sse";
  url: string;
  headers: Record<string, string>;
  useAzureAuth: boolean;
  azureAuthScope: string | null;
  timeoutSeconds: number | null;
};

export type ThreadMcpStdioServer = {
  id: string;
  threadId: string;
  selectionOrder: number;
  name: string;
  transport: "stdio";
  command: string;
  args: string[];
  cwd: string | null;
  env: Record<string, string>;
};

export type ThreadMcpServer = ThreadMcpHttpServer | ThreadMcpStdioServer;

export function cloneThreadMcpServer(server: ThreadMcpServer): ThreadMcpServer {
  return server.transport === "stdio"
    ? {
        ...server,
        args: [...server.args],
        env: { ...server.env },
      }
    : {
        ...server,
        headers: { ...server.headers },
      };
}

export function cloneThreadMcpServers(servers: ThreadMcpServer[]): ThreadMcpServer[] {
  return servers.map(cloneThreadMcpServer);
}
