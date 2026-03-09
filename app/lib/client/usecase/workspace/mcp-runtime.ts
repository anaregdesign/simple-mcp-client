/**
 * Client controller MCP runtime helpers.
 */
import type { ChatRequestMcpServer } from "~/lib/contracts/chat/request";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";

export function serializeMcpServersForChatRequest(
  servers: McpServerConfig[],
): ChatRequestMcpServer[] {
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
