import type { McpServerConfig } from "~/lib/contracts/mcp/profile";

export function upsertMcpServer(
  current: McpServerConfig[],
  profile: McpServerConfig,
): McpServerConfig[] {
  const existingIndex = current.findIndex((entry) => entry.id === profile.id);
  if (existingIndex < 0) {
    return [...current, profile];
  }

  return current.map((entry, index) => (index === existingIndex ? profile : entry));
}
