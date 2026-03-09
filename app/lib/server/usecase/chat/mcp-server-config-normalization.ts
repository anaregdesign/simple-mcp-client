import { buildMcpServerConfigKey } from "~/lib/contracts/mcp/config-key";
import type {
  ClientMcpServerConfig,
} from "~/lib/server/usecase/chat/mcp-server-config-types";

export function applyDefaultThreadDirectoryToStdioServers(
  mcpServers: ClientMcpServerConfig[],
  threadDirectoryPath: string | null,
  userDirectoryPath: string | null,
): ClientMcpServerConfig[] {
  if (!threadDirectoryPath) {
    return mcpServers;
  }

  const normalizedUserDirectoryPath =
    normalizePathForComparison(userDirectoryPath);
  const dedupeKeys = new Set<string>();
  const normalized: ClientMcpServerConfig[] = [];
  for (const server of mcpServers) {
    let nextServer: ClientMcpServerConfig = server;
    if (server.transport === "stdio") {
      const hasExplicitCwd =
        typeof server.cwd === "string" && server.cwd.trim().length > 0;
      const isLegacyWorkspaceRootCwd =
        hasExplicitCwd &&
        normalizePathForComparison(server.cwd) === normalizedUserDirectoryPath;
      if (!hasExplicitCwd || isLegacyWorkspaceRootCwd) {
        nextServer = {
          ...server,
          cwd: threadDirectoryPath,
        };
      }
    }
    const dedupeKey = buildMcpServerSessionConfigKey(nextServer);
    if (dedupeKeys.has(dedupeKey)) {
      continue;
    }

    dedupeKeys.add(dedupeKey);
    normalized.push(nextServer);
  }

  return normalized;
}

export function buildMcpServerSessionConfigKey(
  config: ClientMcpServerConfig,
): string {
  return buildMcpServerConfigKey(config);
}

function normalizePathForComparison(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replaceAll("\\", "/").toLowerCase();
}
