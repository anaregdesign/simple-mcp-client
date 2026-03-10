import {
  buildMcpServerKey,
  type McpServerConfig,
} from "~/lib/contracts/mcp/profile";
import {
  buildMcpServerFromProfileForm,
  type McpProfileFormState,
} from "~/lib/client/usecase/workspace/mcp-profile-form";
import { createId } from "~/lib/client/usecase/workspace/ids";
import {
  reconcileSavedThreadMcpServer,
  removeThreadMcpServerByConfig,
} from "~/lib/client/usecase/workspace/threads/thread-mcp-server-operations";
import type { ThreadState } from "~/lib/contracts/threads/types";

export const MCP_PROFILE_ARCHIVED_THREAD_ERROR =
  "Archived thread is read-only. Restore it from Archives to edit MCP servers.";

export const MCP_PROFILE_NOT_AVAILABLE_ERROR =
  "Selected MCP server is not available.";

type McpProfileMutationLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

export type McpProfileMutationDependencies = {
  isArchivedThread: (threadIdRaw: string) => boolean;
  readActiveThreadId: () => string;
  readWorkspaceMcpServerProfiles: () => McpServerConfig[];
  readActiveThreadMcpServers: () => McpServerConfig[];
  readEditingMcpServerId: () => string;
  isDeletingWorkspaceMcpServerProfile: boolean;
  setWorkspaceMcpServerProfileError: (value: string | null) => void;
  clearMcpServerEditState: () => void;
  setEditingMcpServerId: (value: string) => void;
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
    options?: McpProfileMutationLogOptions,
  ) => void;
  logClientWarning: (
    eventName: string,
    message: string,
    options?: McpProfileMutationLogOptions,
  ) => void;
  mcpFormState: McpProfileFormState;
};

export async function deleteWorkspaceMcpServerProfile(
  deps: McpProfileMutationDependencies,
  serverIdRaw: string,
): Promise<void> {
  if (deps.isArchivedThread(deps.readActiveThreadId())) {
    deps.setWorkspaceMcpServerProfileError(MCP_PROFILE_ARCHIVED_THREAD_ERROR);
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
    deps.setWorkspaceMcpServerProfileError(MCP_PROFILE_NOT_AVAILABLE_ERROR);
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
}

export async function saveWorkspaceMcpServerProfile(
  deps: McpProfileMutationDependencies,
): Promise<void> {
  if (deps.isArchivedThread(deps.readActiveThreadId())) {
    deps.setMcpFormError(MCP_PROFILE_ARCHIVED_THREAD_ERROR);
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
    deps.setMcpFormError(MCP_PROFILE_NOT_AVAILABLE_ERROR);
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
        (server) => buildMcpServerKey(server) === buildMcpServerKey(serverToSave),
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
      saveError instanceof Error ? saveError.message : "Failed to save MCP server.",
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
}
