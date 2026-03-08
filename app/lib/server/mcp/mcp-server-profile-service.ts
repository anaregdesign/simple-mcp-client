/**
 * Shared MCP server profile service for API routes.
 */
import {
  deleteWorkspaceMcpServerProfile,
  ensureDefaultMcpServersForUser,
  mergeDefaultWorkspaceMcpServerProfiles,
  parseIncomingMcpServer,
  readAuthenticatedUser,
  readErrorMessage,
  readWorkspaceMcpServerProfiles,
  upsertWorkspaceMcpServerProfile,
  writeWorkspaceMcpServerProfiles,
} from "~/routes/api.mcp.servers";

export {
  deleteWorkspaceMcpServerProfile,
  ensureDefaultMcpServersForUser,
  mergeDefaultWorkspaceMcpServerProfiles,
  parseIncomingMcpServer,
  readAuthenticatedUser,
  readErrorMessage,
  readWorkspaceMcpServerProfiles,
  upsertWorkspaceMcpServerProfile,
  writeWorkspaceMcpServerProfiles,
};
