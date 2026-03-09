import {
  getAzureBearerTokenForScope,
} from "~/lib/server/infrastructure/gateways/azure/azure-openai-gateway";
import type { ClientMcpServerConfig } from "~/lib/server/infrastructure/gateways/chat/request-parser";

export async function getAzureMcpAuthorizationToken(
  scope: string,
  tenantId: string,
): Promise<string> {
  try {
    return await getAzureBearerTokenForScope(scope, tenantId);
  } catch {
    throw new Error(
      `Azure credential failed to acquire token for MCP Authorization header (scope: ${scope}). Run Azure Login and try again.`,
    );
  }
}

export function describeMcpServer(config: ClientMcpServerConfig): string {
  if (config.transport === "stdio") {
    const argsPart = config.args.length > 0 ? ` ${config.args.join(" ")}` : "";
    return `stdio:${config.command}${argsPart}`;
  }

  return config.useAzureAuth
    ? `${config.url} (azure auth: ${config.azureAuthScope}, timeout: ${config.timeoutSeconds}s)`
    : `${config.url} (timeout: ${config.timeoutSeconds}s)`;
}
