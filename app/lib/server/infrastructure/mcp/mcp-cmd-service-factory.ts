import { NodeMcpCmdShellGateway } from "~/lib/server/infrastructure/gateways/mcp/mcp-cmd-shell-gateway";
import { resolveWorkingDirectory } from "~/lib/server/infrastructure/gateways/mcp/mcp-cmd-working-directory";
import { McpCmdService } from "~/lib/server/usecase/mcp/mcp-cmd-service";

export function createMcpCmdServiceWithInfrastructure() {
  return new McpCmdService({
    resolveWorkingDirectory,
    shellGateway: new NodeMcpCmdShellGateway(),
  });
}
