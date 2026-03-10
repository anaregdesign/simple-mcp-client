import {
  DEFAULT_MCP_TRANSPORT,
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
} from "~/lib/constants/mcp";
import type { McpServersSnapshot } from "~/lib/client/infrastructure/api/mcp-servers-api-client";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { McpTransport } from "~/lib/client/usecase/workspace/view-types";

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

type McpProfileFormSetters = {
  setMcpNameInput: (value: string) => void;
  setMcpTransport: (value: McpTransport) => void;
  setMcpUrlInput: (value: string) => void;
  setMcpCommandInput: (value: string) => void;
  setMcpArgsInput: (value: string) => void;
  setMcpCwdInput: (value: string) => void;
  setMcpEnvInput: (value: string) => void;
  setMcpHeadersInput: (value: string) => void;
  setMcpUseAzureAuthInput: (value: boolean) => void;
  setMcpAzureAuthScopeInput: (value: string) => void;
  setMcpTimeoutSecondsInput: (value: string) => void;
};

type ClearMcpProfileEditStateOptions = McpProfileFormSetters & {
  setEditingMcpServerId: (value: string) => void;
  setMcpFormError: (value: string | null) => void;
  setMcpFormWarning: (value: string | null) => void;
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

export function resetMcpServerFormInputs(
  setters: McpProfileFormSetters,
): void {
  setters.setMcpNameInput("");
  setters.setMcpUrlInput("");
  setters.setMcpCommandInput("");
  setters.setMcpArgsInput("");
  setters.setMcpCwdInput("");
  setters.setMcpEnvInput("");
  setters.setMcpHeadersInput("");
  setters.setMcpUseAzureAuthInput(false);
  setters.setMcpAzureAuthScopeInput(MCP_DEFAULT_AZURE_AUTH_SCOPE);
  setters.setMcpTimeoutSecondsInput(String(MCP_DEFAULT_TIMEOUT_SECONDS));
  setters.setMcpTransport(DEFAULT_MCP_TRANSPORT);
}

export function clearMcpServerEditState(
  options: ClearMcpProfileEditStateOptions,
): void {
  options.setEditingMcpServerId("");
  resetMcpServerFormInputs(options);
  options.setMcpFormError(null);
  options.setMcpFormWarning(null);
}

export function populateMcpServerFormForEdit(
  server: McpServerConfig,
  setters: McpProfileFormSetters,
): void {
  setters.setMcpNameInput(server.name);
  setters.setMcpTransport(server.transport);
  if (server.transport === "stdio") {
    setters.setMcpCommandInput(server.command);
    setters.setMcpArgsInput(
      server.args.length > 0 ? JSON.stringify(server.args) : "",
    );
    setters.setMcpCwdInput(server.cwd ?? "");
    setters.setMcpEnvInput(
      Object.entries(server.env)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n"),
    );
    setters.setMcpUrlInput("");
    setters.setMcpHeadersInput("");
    setters.setMcpUseAzureAuthInput(false);
    setters.setMcpAzureAuthScopeInput(MCP_DEFAULT_AZURE_AUTH_SCOPE);
    setters.setMcpTimeoutSecondsInput(String(MCP_DEFAULT_TIMEOUT_SECONDS));
    return;
  }

  setters.setMcpUrlInput(server.url);
  setters.setMcpHeadersInput(
    Object.entries(server.headers)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );
  setters.setMcpUseAzureAuthInput(server.useAzureAuth);
  setters.setMcpAzureAuthScopeInput(server.azureAuthScope);
  setters.setMcpTimeoutSecondsInput(String(server.timeoutSeconds));
  setters.setMcpCommandInput("");
  setters.setMcpArgsInput("");
  setters.setMcpCwdInput("");
  setters.setMcpEnvInput("");
}
