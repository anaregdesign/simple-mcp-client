import {
  type McpServerConfig,
} from "~/lib/contracts/mcp/profile";
import {
  removeThreadMcpServerById,
  toggleThreadMcpServer,
} from "~/lib/client/usecase/workspace/threads/thread-mcp-server-operations";
import type { McpProfileFormState } from "~/lib/client/usecase/workspace/mcp-profiles/form";
import {
  deleteWorkspaceMcpServerProfile,
  MCP_PROFILE_ARCHIVED_THREAD_ERROR,
  MCP_PROFILE_NOT_AVAILABLE_ERROR,
  saveWorkspaceMcpServerProfile,
} from "~/lib/client/usecase/workspace/mcp-profiles/mutations";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

type McpProfileLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type McpProfileHandlerDependencies = {
  isArchivedThread: (threadIdRaw: string) => boolean;
  readActiveThreadId: () => string;
  readWorkspaceMcpServerProfiles: () => McpServerConfig[];
  readActiveThreadMcpServers: () => McpServerConfig[];
  readEditingMcpServerId: () => string;
  isDeletingWorkspaceMcpServerProfile: boolean;
  setWorkspaceMcpServerProfileError: (value: string | null) => void;
  loadWorkspaceMcpServerProfiles: () => Promise<void>;
  clearMcpServerEditState: () => void;
  setEditingMcpServerId: (value: string) => void;
  populateMcpServerFormForEdit: (server: McpServerConfig) => void;
  setMcpFormError: (value: string | null) => void;
  setMcpFormWarning: (value: string | null) => void;
  setIsDeletingWorkspaceMcpServerProfile: (value: boolean) => void;
  setIsSavingMcpServer: (value: boolean) => void;
  applyWorkspaceMcpServerProfiles: (profiles: McpServerConfig[]) => void;
  deleteWorkspaceMcpServerProfileFromConfig: (
    serverId: string,
  ) => Promise<McpServerConfig[]>;
  saveMcpServerToConfig: (
    server: McpServerConfig,
    options?: {
      isUpdate?: boolean;
    },
  ) => Promise<{
    profile: McpServerConfig;
    warning: string | null;
  }>;
  connectMcpServerToActiveThread: (serverToConnect: McpServerConfig) => void;
  resetMcpServerFormInputs: () => void;
  updateThreadStateById: (
    threadId: string,
    updater: (current: ThreadState) => ThreadState,
  ) => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: McpProfileLogOptions,
  ) => void;
  logClientWarning: (
    eventName: string,
    message: string,
    options?: McpProfileLogOptions,
  ) => void;
  mcpFormState: McpProfileFormState;
};

export type McpProfileHandlers = {
  handleReloadWorkspaceMcpServerProfiles: () => void;
  handleCancelMcpServerEdit: () => void;
  handleEditWorkspaceMcpServerProfile: (serverIdRaw: string) => void;
  handleDeleteWorkspaceMcpServerProfile: (
    serverIdRaw: string,
  ) => Promise<void>;
  handleToggleWorkspaceMcpServerProfile: (serverIdRaw: string) => void;
  handleRemoveMcpServer: (id: string) => void;
  handleAddMcpServer: () => Promise<void>;
};

export function createMcpProfileHandlers(
  deps: McpProfileHandlerDependencies,
): McpProfileHandlers {
  return {
    handleReloadWorkspaceMcpServerProfiles() {
      deps.setWorkspaceMcpServerProfileError(null);
      void deps.loadWorkspaceMcpServerProfiles();
    },

    handleCancelMcpServerEdit() {
      deps.clearMcpServerEditState();
      deps.setWorkspaceMcpServerProfileError(null);
    },

    handleEditWorkspaceMcpServerProfile(serverIdRaw: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        deps.setWorkspaceMcpServerProfileError(
          MCP_PROFILE_ARCHIVED_THREAD_ERROR,
        );
        return;
      }

      const serverId = serverIdRaw.trim();
      if (!serverId) {
        return;
      }

      const selected = deps
        .readWorkspaceMcpServerProfiles()
        .find((server) => server.id === serverId);
      if (!selected) {
        deps.setWorkspaceMcpServerProfileError(MCP_PROFILE_NOT_AVAILABLE_ERROR);
        return;
      }

      deps.setEditingMcpServerId(serverId);
      deps.populateMcpServerFormForEdit(selected);
      deps.setMcpFormError(null);
      deps.setMcpFormWarning(null);
      deps.setWorkspaceMcpServerProfileError(null);
    },

    async handleDeleteWorkspaceMcpServerProfile(serverIdRaw: string) {
      await deleteWorkspaceMcpServerProfile(deps, serverIdRaw);
    },

    handleToggleWorkspaceMcpServerProfile(serverIdRaw: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        deps.setWorkspaceMcpServerProfileError(MCP_PROFILE_ARCHIVED_THREAD_ERROR);
        return;
      }

      const serverId = serverIdRaw.trim();
      if (!serverId) {
        return;
      }

      const selected = deps
        .readWorkspaceMcpServerProfiles()
        .find((server) => server.id === serverId);
      if (!selected) {
        deps.setWorkspaceMcpServerProfileError(MCP_PROFILE_NOT_AVAILABLE_ERROR);
        return;
      }

      const activeId = deps.readActiveThreadId().trim();
      if (!activeId) {
        return;
      }

      deps.updateThreadStateById(activeId, (thread) =>
        toggleThreadMcpServer(thread, selected),
      );
      deps.setWorkspaceMcpServerProfileError(null);
    },

    handleRemoveMcpServer(id: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      const activeId = deps.readActiveThreadId().trim();
      if (!activeId) {
        return;
      }

      deps.updateThreadStateById(activeId, (thread) =>
        removeThreadMcpServerById(thread, id),
      );
    },

    async handleAddMcpServer() {
      await saveWorkspaceMcpServerProfile(deps);
    },
  };
}
