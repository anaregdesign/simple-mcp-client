import type { McpTransport } from "~/lib/client/usecase/workspace/view-types";
import { MCP_DEFAULT_AZURE_AUTH_SCOPE } from "~/lib/constants/mcp";
import {
  buildMcpServerKey,
  type McpServerConfig,
} from "~/lib/contracts/mcp/profile";
import {
  parseAzureAuthScopeInput,
  parseHttpHeadersInput,
  parseMcpTimeoutSecondsInput,
} from "~/lib/client/usecase/workspace/mcp-http-inputs";
import {
  parseStdioArgsInput,
  parseStdioEnvInput,
} from "~/lib/client/usecase/workspace/mcp-stdio-inputs";
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
  connectMcpServerToAgent: (serverToConnect: McpServerConfig) => void;
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
  mcpFormState: {
    editingMcpServerId: string;
    mcpNameInput: string;
    mcpTransport: McpTransport;
    mcpUrlInput: string;
    mcpCommandInput: string;
    mcpArgsInput: string;
    mcpCwdInput: string;
    mcpEnvInput: string;
    mcpHeadersInput: string;
    mcpUseAzureAuthInput: boolean;
    mcpAzureAuthScopeInput: string;
    mcpTimeoutSecondsInput: string;
  };
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

        const deletedKey = buildMcpServerKey(selected);
        const activeId = deps.readActiveThreadId().trim();
        if (activeId) {
          deps.updateThreadStateById(activeId, (thread) => ({
            ...thread,
            mcpServers: thread.mcpServers.filter(
              (server) => buildMcpServerKey(server) !== deletedKey,
            ),
          }));
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

      const selectedKey = buildMcpServerKey(selected);
      const activeId = deps.readActiveThreadId().trim();
      if (!activeId) {
        return;
      }

      deps.updateThreadStateById(activeId, (thread) => {
        const alreadyConnected = thread.mcpServers.some(
          (server) => buildMcpServerKey(server) === selectedKey,
        );
        if (alreadyConnected) {
          return {
            ...thread,
            mcpServers: thread.mcpServers.filter(
              (server) => buildMcpServerKey(server) !== selectedKey,
            ),
          };
        }

        return {
          ...thread,
          mcpServers: [...thread.mcpServers, selected],
        };
      });
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

      deps.updateThreadStateById(activeId, (thread) => ({
        ...thread,
        mcpServers: thread.mcpServers.filter((server) => server.id !== id),
      }));
    },

    async handleAddMcpServer() {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        deps.setMcpFormError(
          "Archived thread is read-only. Restore it from Archives to edit MCP servers.",
        );
        return;
      }

      const {
        editingMcpServerId,
        mcpNameInput,
        mcpTransport,
        mcpUrlInput,
        mcpCommandInput,
        mcpArgsInput,
        mcpCwdInput,
        mcpEnvInput,
        mcpHeadersInput,
        mcpUseAzureAuthInput,
        mcpAzureAuthScopeInput,
        mcpTimeoutSecondsInput,
      } = deps.mcpFormState;

      const editingServerId = editingMcpServerId.trim();
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

      const rawName = mcpNameInput.trim();
      deps.setMcpFormError(null);
      deps.setMcpFormWarning(null);

      let serverToSave: McpServerConfig;
      const serverId = isEditing ? editingServerId : createId("mcp");

      if (mcpTransport === "stdio") {
        const command = mcpCommandInput.trim();
        if (!command) {
          deps.setMcpFormError("MCP stdio command is required.");
          return;
        }

        if (/\s/.test(command)) {
          deps.setMcpFormError("MCP stdio command must not include spaces.");
          return;
        }

        const argsResult = parseStdioArgsInput(mcpArgsInput);
        if (!argsResult.ok) {
          deps.setMcpFormError(argsResult.error);
          return;
        }

        const envResult = parseStdioEnvInput(mcpEnvInput);
        if (!envResult.ok) {
          deps.setMcpFormError(envResult.error);
          return;
        }

        const cwd = mcpCwdInput.trim();
        const name = rawName || command;

        serverToSave = {
          name,
          transport: "stdio",
          command,
          args: argsResult.value,
          cwd: cwd || undefined,
          env: envResult.value,
          id: serverId,
        };
      } else {
        const rawUrl = mcpUrlInput.trim();
        if (!rawUrl) {
          deps.setMcpFormError("MCP server URL is required.");
          return;
        }

        let parsed: URL;
        try {
          parsed = new URL(rawUrl);
        } catch {
          deps.setMcpFormError("MCP server URL is invalid.");
          return;
        }

        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          deps.setMcpFormError(
            "MCP server URL must start with http:// or https://.",
          );
          return;
        }

        const name = rawName || parsed.hostname;
        if (!name) {
          deps.setMcpFormError("MCP server name is required.");
          return;
        }

        const normalizedUrl = parsed.toString();
        const headersResult = parseHttpHeadersInput(mcpHeadersInput);
        if (!headersResult.ok) {
          deps.setMcpFormError(headersResult.error);
          return;
        }

        let azureAuthScope = MCP_DEFAULT_AZURE_AUTH_SCOPE;
        if (mcpUseAzureAuthInput) {
          const scopeResult = parseAzureAuthScopeInput(mcpAzureAuthScopeInput);
          if (!scopeResult.ok) {
            deps.setMcpFormError(scopeResult.error);
            return;
          }
          azureAuthScope = scopeResult.value;
        }
        const timeoutResult = parseMcpTimeoutSecondsInput(
          mcpTimeoutSecondsInput,
        );
        if (!timeoutResult.ok) {
          deps.setMcpFormError(timeoutResult.error);
          return;
        }

        serverToSave = {
          id: serverId,
          name,
          url: normalizedUrl,
          transport: mcpTransport,
          headers: headersResult.value,
          useAzureAuth: mcpUseAzureAuthInput,
          azureAuthScope,
          timeoutSeconds: timeoutResult.value,
        };
      }

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
          const previousServerKey = buildMcpServerKey(editingServer);
          const nextServerKey = buildMcpServerKey(savedProfile);
          const activeId = deps.readActiveThreadId().trim();
          if (activeId) {
            deps.updateThreadStateById(activeId, (thread) => {
              const filtered = thread.mcpServers.filter(
                (server) => buildMcpServerKey(server) !== previousServerKey,
              );
              if (filtered.length === thread.mcpServers.length) {
                return thread;
              }

              const nextIndex = filtered.findIndex(
                (server) => buildMcpServerKey(server) === nextServerKey,
              );
              if (nextIndex >= 0) {
                return {
                  ...thread,
                  mcpServers: filtered.map((server, index) =>
                    index === nextIndex
                      ? { ...server, name: savedProfile.name }
                      : server,
                  ),
                };
              }

              return {
                ...thread,
                mcpServers: [...filtered, savedProfile],
              };
            });
          }
        } else {
          deps.connectMcpServerToAgent(savedProfile);
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
