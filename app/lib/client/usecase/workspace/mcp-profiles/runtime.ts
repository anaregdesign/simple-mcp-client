/**
 * Client controller MCP runtime helpers.
 */
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";

export type ChatRuntimeMcpServer =
  | {
      name: string;
      transport: "stdio";
      command: string;
      args: string[];
      cwd?: string;
      env: Record<string, string>;
    }
  | {
      name: string;
      transport: "streamable_http" | "sse";
      url: string;
      headers: Record<string, string>;
      useAzureAuth: boolean;
      azureAuthScope: string;
      timeoutSeconds: number;
    };

export function serializeMcpServersForChatRequest(
  servers: McpServerConfig[],
): ChatRuntimeMcpServer[] {
  return servers.map((server) =>
    server.transport === "stdio"
      ? {
          name: server.name,
          transport: server.transport,
          command: server.command,
          args: server.args,
          cwd: server.cwd,
          env: server.env,
        }
      : {
          name: server.name,
          transport: server.transport,
          url: server.url,
          headers: server.headers,
          useAzureAuth: server.useAzureAuth,
          azureAuthScope: server.azureAuthScope,
          timeoutSeconds: server.timeoutSeconds,
        },
  );
}
