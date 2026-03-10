import {
  type McpServersSnapshot,
} from "~/lib/client/infrastructure/api/mcp-servers-api-client";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";

type McpProfileLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type CreateWorkspaceMcpProfileOperationDepsOptions = {
  readActiveWorkspaceUserKey: () => string;
  nextWorkspaceMcpServerProfileRequestSeq: () => number;
  readWorkspaceMcpServerProfileRequestSeq: () => number;
  readWorkspaceMcpServerProfiles: () => McpServerConfig[];
  writeWorkspaceMcpServerProfiles: (profiles: McpServerConfig[]) => void;
  setWorkspaceMcpServerProfileError: (value: string | null) => void;
  setIsLoadingWorkspaceMcpServerProfiles: (value: boolean) => void;
  setEditingMcpServerId: (value: string) => void;
  setIsDeletingWorkspaceMcpServerProfile: (value: boolean) => void;
  markAzureAuthRequired: () => void;
  loadProfiles: (options: {
    onAuthRequired?: () => void;
  }) => Promise<McpServersSnapshot>;
  saveProfile: (
    server: McpServerConfig,
    options: {
      isUpdate?: boolean;
      onAuthRequired?: () => void;
    },
  ) => Promise<McpServersSnapshot>;
  deleteProfile: (
    serverId: string,
    options: {
      onAuthRequired?: () => void;
    },
  ) => Promise<McpServersSnapshot>;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: McpProfileLogOptions,
  ) => void;
};

export function createWorkspaceMcpProfileOperationDeps(
  options: CreateWorkspaceMcpProfileOperationDepsOptions,
) {
  return {
    readActiveWorkspaceUserKey: options.readActiveWorkspaceUserKey,
    nextWorkspaceMcpServerProfileRequestSeq:
      options.nextWorkspaceMcpServerProfileRequestSeq,
    readWorkspaceMcpServerProfileRequestSeq:
      options.readWorkspaceMcpServerProfileRequestSeq,
    readWorkspaceMcpServerProfiles: options.readWorkspaceMcpServerProfiles,
    writeWorkspaceMcpServerProfiles: options.writeWorkspaceMcpServerProfiles,
    setWorkspaceMcpServerProfileError:
      options.setWorkspaceMcpServerProfileError,
    setIsLoadingWorkspaceMcpServerProfiles:
      options.setIsLoadingWorkspaceMcpServerProfiles,
    setEditingMcpServerId: options.setEditingMcpServerId,
    setIsDeletingWorkspaceMcpServerProfile:
      options.setIsDeletingWorkspaceMcpServerProfile,
    markAzureAuthRequired: options.markAzureAuthRequired,
    loadProfiles: options.loadProfiles,
    saveProfile: options.saveProfile,
    deleteProfile: options.deleteProfile,
    logClientError: options.logClientError,
  };
}
