import type { McpTransport } from "~/lib/client/usecase/workspace/view-types";
import {
  buildMcpServerKey,
  type McpServerConfig,
} from "~/lib/contracts/mcp/profile";
import {
  connectMcpServerToThread,
  reconcileSavedThreadMcpServer,
  removeThreadMcpServerByConfig,
  removeThreadMcpServerById,
  toggleThreadMcpServer,
} from "~/lib/client/usecase/workspace/thread-mcp-server-operations";
import {
  buildMcpServerFromProfileForm,
  type McpProfileFormState,
} from "~/lib/client/usecase/workspace/mcp-profile-form";
import { createId } from "~/lib/client/usecase/workspace/ids";
import type { ThreadState } from "~/lib/contracts/threads/types";

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
          "Archived thread is read-only. Restore it from Archives to edit MCP servers.",
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
        deps.setWorkspaceMcpServerProfileError(
          "Selected MCP server is not available.",
        );
        return;
      }

      deps.setEditingMcpServerId(serverId);
      deps.populateMcpServerFormForEdit(selected);
      deps.setMcpFormError(null);
      deps.setMcpFormWarning(null);
      deps.setWorkspaceMcpServerProfileError(null);
    },

    async handleDeleteWorkspaceMcpServerProfile(serverIdRaw: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        deps.setWorkspaceMcpServerProfileError(
          "Archived thread is read-only. Restore it from Archives to edit MCP servers.",
        );
        return;
      }

      if (deps.isDeletingWorkspaceMcpServerProfile) {
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
        deps.setWorkspaceMcpServerProfileError(
          "Selected MCP server is not available.",
        );
        return;
      }

      deps.setIsDeletingWorkspaceMcpServerProfile(true);
      deps.setWorkspaceMcpServerProfileError(null);

      try {
        const nextWorkspaceMcpServerProfiles =
          await deps.deleteWorkspaceMcpServerProfileFromConfig(serverId);
        deps.applyWorkspaceMcpServerProfiles(nextWorkspaceMcpServerProfiles);

        const activeId = deps.readActiveThreadId().trim();
        if (activeId) {
          deps.updateThreadStateById(activeId, (thread) =>
            removeThreadMcpServerByConfig(thread, selected),
          );
        }

        if (deps.readEditingMcpServerId().trim() === serverId) {
          deps.clearMcpServerEditState();
        }
      } catch (deleteError) {
        deps.logClientError("delete_mcp_server_failed", deleteError, {
          action: "delete_saved_mcp_server",
          context: {
            serverId,
            serverName: selected.name,
          },
        });
        deps.setWorkspaceMcpServerProfileError(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete MCP server.",
        );
      } finally {
        deps.setIsDeletingWorkspaceMcpServerProfile(false);
      }
    },

    handleToggleWorkspaceMcpServerProfile(serverIdRaw: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        deps.setWorkspaceMcpServerProfileError(
          "Archived thread is read-only. Restore it from Archives to edit MCP servers.",
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
        deps.setWorkspaceMcpServerProfileError(
          "Selected MCP server is not available.",
        );
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
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        deps.setMcpFormError(
          "Archived thread is read-only. Restore it from Archives to edit MCP servers.",
        );
        return;
      }

      const editingServerId = deps.mcpFormState.editingMcpServerId.trim();
      const isEditing = editingServerId.length > 0;
      const editingServer = isEditing
        ? (deps
            .readWorkspaceMcpServerProfiles()
            .find((server) => server.id === editingServerId) ?? null)
        : null;
      if (isEditing && !editingServer) {
        deps.setEditingMcpServerId("");
        deps.setMcpFormError("Selected MCP server is not available.");
        return;
      }

      deps.setMcpFormError(null);
      deps.setMcpFormWarning(null);

      const serverId = isEditing ? editingServerId : createId("mcp");
      const buildResult = buildMcpServerFromProfileForm({
        serverId,
        formState: deps.mcpFormState,
      });
      if (!buildResult.ok) {
        deps.setMcpFormError(buildResult.error);
        return;
      }
      const serverToSave = buildResult.server;

      const activeThreadMcpServers = deps.readActiveThreadMcpServers();
      const existingServerIndex = isEditing
        ? -1
        : activeThreadMcpServers.findIndex(
            (server) =>
              buildMcpServerKey(server) === buildMcpServerKey(serverToSave),
          );
      const existingServerName =
        existingServerIndex >= 0
          ? (activeThreadMcpServers[existingServerIndex]?.name ?? "")
          : "";

      deps.setIsSavingMcpServer(true);
      let saveWarning: string | null = null;
      let savedProfile = serverToSave;
      try {
        const saveResult = await deps.saveMcpServerToConfig(serverToSave, {
          isUpdate: isEditing,
        });
        saveWarning = saveResult.warning;
        savedProfile = saveResult.profile;

        if (isEditing && editingServer) {
          const activeId = deps.readActiveThreadId().trim();
          if (activeId) {
            deps.updateThreadStateById(activeId, (thread) =>
              reconcileSavedThreadMcpServer(thread, {
                previousServer: editingServer,
                savedProfile,
              }),
            );
          }
        } else {
          deps.connectMcpServerToActiveThread(savedProfile);
        }

        deps.setWorkspaceMcpServerProfileError(null);
      } catch (saveError) {
        deps.logClientError("save_mcp_server_failed", saveError, {
          action: "save_mcp_server",
        });
        deps.setMcpFormError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to save MCP server.",
        );
        return;
      } finally {
        deps.setIsSavingMcpServer(false);
      }

      deps.setMcpFormError(null);
      if (isEditing) {
        deps.setMcpFormWarning(saveWarning);
        if (saveWarning) {
          deps.logClientWarning("mcp_server_edit_warning", saveWarning, {
            action: "save_mcp_server",
            context: {
              savedProfileName: savedProfile.name,
              transport: savedProfile.transport,
            },
          });
        }
      } else if (existingServerIndex >= 0) {
        const fallbackLocalWarning =
          existingServerName && existingServerName !== savedProfile.name
            ? `An MCP server with the same configuration already exists. Renamed it from "${existingServerName}" to "${savedProfile.name}".`
            : "An MCP server with the same configuration already exists. Reused the existing entry.";
        const warningToShow = saveWarning ?? fallbackLocalWarning;
        deps.setMcpFormWarning(warningToShow);
        deps.logClientWarning("mcp_server_duplicate_warning", warningToShow, {
          action: "save_mcp_server",
          context: {
            existingServerName,
            savedProfileName: savedProfile.name,
            transport: serverToSave.transport,
          },
        });
      } else {
        deps.setMcpFormWarning(saveWarning);
        if (saveWarning) {
          deps.logClientWarning("mcp_server_save_warning", saveWarning, {
            action: "save_mcp_server",
            context: {
              savedProfileName: savedProfile.name,
              transport: serverToSave.transport,
            },
          });
        }
      }
      deps.setEditingMcpServerId("");
      deps.resetMcpServerFormInputs();
    },
  };
}
