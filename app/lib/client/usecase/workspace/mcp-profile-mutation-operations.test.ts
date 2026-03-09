import { afterEach, describe, expect, it, vi } from "vitest";
import type { McpHttpServerConfig, McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadState } from "~/lib/contracts/threads/types";
import {
  deleteWorkspaceMcpServerProfile,
  MCP_PROFILE_ARCHIVED_THREAD_ERROR,
  MCP_PROFILE_NOT_AVAILABLE_ERROR,
  saveWorkspaceMcpServerProfile,
} from "./mcp-profile-mutation-operations";
import { connectMcpServerToThread } from "./thread-mcp-server-operations";

function createHttpServer(
  overrides: Partial<McpHttpServerConfig> & {
    id: string;
    name: string;
    url: string;
  },
): McpHttpServerConfig {
  const { id, name, url, ...rest } = overrides;
  return {
    id,
    name,
    transport: "streamable_http",
    url,
    headers: {},
    useAzureAuth: false,
    azureAuthScope: "https://cognitiveservices.azure.com/.default",
    timeoutSeconds: 30,
    ...rest,
  };
}

function createThreadState(overrides: Partial<ThreadState> = {}): ThreadState {
  return {
    id: "thread-1",
    name: "Thread 1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "high",
    webSearchEnabled: false,
    agentInstruction: "Instruction",
    instructionContextToggles: {
      system: true,
    },
    threadEnvironment: {},
    messages: [],
    mcpServers: [],
    mcpRpcLogs: [],
    skillSelections: [],
    ...overrides,
  };
}

function createDependencies(
  overrides: {
    isArchivedThread?: boolean;
    isDeletingWorkspaceMcpServerProfile?: boolean;
    workspaceProfiles?: McpServerConfig[];
    activeThread?: ThreadState;
    editingMcpServerId?: string;
    deleteWorkspaceMcpServerProfileFromConfig?: (
      serverId: string,
    ) => Promise<McpServerConfig[]>;
    saveMcpServerToConfig?: (
      server: McpServerConfig,
      options?: { isUpdate?: boolean },
    ) => Promise<{
      profile: McpServerConfig;
      warning: string | null;
    }>;
  } = {},
) {
  const state = {
    activeThreadId: "thread-1",
    workspaceProfiles:
      overrides.workspaceProfiles ??
      [
        createHttpServer({
          id: "mcp-1",
          name: "Filesystem",
          url: "https://example.test/mcp",
        }),
      ],
    activeThread:
      overrides.activeThread ??
      createThreadState({
        mcpServers: [
          createHttpServer({
            id: "mcp-1",
            name: "Filesystem",
            url: "https://example.test/mcp",
          }),
        ],
      }),
    editingMcpServerId: overrides.editingMcpServerId ?? "",
    workspaceError: "stale" as string | null,
    mcpFormError: "stale" as string | null,
    mcpFormWarning: "stale" as string | null,
    isDeleting:
      overrides.isDeletingWorkspaceMcpServerProfile ?? false,
    isSaving: false,
    clearedEditStateCount: 0,
    resetFormCount: 0,
    warningEvents: [] as string[],
    errorEvents: [] as string[],
    connectedProfiles: [] as McpServerConfig[],
  };

  const deps = {
    isArchivedThread: () => overrides.isArchivedThread ?? false,
    readActiveThreadId: () => state.activeThreadId,
    readWorkspaceMcpServerProfiles: () => state.workspaceProfiles,
    readActiveThreadMcpServers: () => state.activeThread.mcpServers,
    readEditingMcpServerId: () => state.editingMcpServerId,
    isDeletingWorkspaceMcpServerProfile: state.isDeleting,
    setWorkspaceMcpServerProfileError: (value: string | null) => {
      state.workspaceError = value;
    },
    clearMcpServerEditState: () => {
      state.clearedEditStateCount += 1;
      state.editingMcpServerId = "";
    },
    setEditingMcpServerId: (value: string) => {
      state.editingMcpServerId = value;
    },
    setMcpFormError: (value: string | null) => {
      state.mcpFormError = value;
    },
    setMcpFormWarning: (value: string | null) => {
      state.mcpFormWarning = value;
    },
    setIsDeletingWorkspaceMcpServerProfile: (value: boolean) => {
      state.isDeleting = value;
      deps.isDeletingWorkspaceMcpServerProfile = value;
    },
    setIsSavingMcpServer: (value: boolean) => {
      state.isSaving = value;
    },
    applyWorkspaceMcpServerProfiles: (profiles: McpServerConfig[]) => {
      state.workspaceProfiles = profiles;
    },
    deleteWorkspaceMcpServerProfileFromConfig:
      overrides.deleteWorkspaceMcpServerProfileFromConfig ??
      vi.fn(async () => []),
    saveMcpServerToConfig:
      overrides.saveMcpServerToConfig ??
      vi.fn(async (server) => ({
        profile: server,
        warning: null,
      })),
    connectMcpServerToActiveThread: (serverToConnect: McpServerConfig) => {
      state.connectedProfiles.push(serverToConnect);
      state.activeThread = connectMcpServerToThread(
        state.activeThread,
        serverToConnect,
      );
    },
    resetMcpServerFormInputs: () => {
      state.resetFormCount += 1;
    },
    updateThreadStateById: (
      _threadId: string,
      updater: (current: ThreadState) => ThreadState,
    ) => {
      state.activeThread = updater(state.activeThread);
    },
    logClientError: (eventName: string) => {
      state.errorEvents.push(eventName);
    },
    logClientWarning: (eventName: string) => {
      state.warningEvents.push(eventName);
    },
    mcpFormState: {
      editingMcpServerId: state.editingMcpServerId,
      mcpNameInput: "Filesystem Renamed",
      mcpTransport: "streamable_http" as const,
      mcpUrlInput: "https://example.test/mcp",
      mcpCommandInput: "",
      mcpArgsInput: "",
      mcpCwdInput: "",
      mcpEnvInput: "",
      mcpHeadersInput: "",
      mcpUseAzureAuthInput: false,
      mcpAzureAuthScopeInput: "",
      mcpTimeoutSecondsInput: "30",
    },
  };

  return { deps, state };
}

describe("mcp-profile-mutation-operations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes a workspace MCP profile and removes it from the active thread", async () => {
    const remainingProfile = createHttpServer({
      id: "mcp-2",
      name: "GitHub",
      url: "https://example.test/github",
    });
    const { deps, state } = createDependencies({
      workspaceProfiles: [
        createHttpServer({
          id: "mcp-1",
          name: "Filesystem",
          url: "https://example.test/mcp",
        }),
        remainingProfile,
      ],
      activeThread: createThreadState({
        mcpServers: [
          createHttpServer({
            id: "mcp-1",
            name: "Filesystem",
            url: "https://example.test/mcp",
          }),
          remainingProfile,
        ],
      }),
      editingMcpServerId: "mcp-1",
      deleteWorkspaceMcpServerProfileFromConfig: vi.fn(async () => [
        remainingProfile,
      ]),
    });

    await deleteWorkspaceMcpServerProfile(deps, "mcp-1");

    expect(state.workspaceProfiles).toEqual([remainingProfile]);
    expect(state.activeThread.mcpServers).toEqual([remainingProfile]);
    expect(state.clearedEditStateCount).toBe(1);
    expect(state.workspaceError).toBeNull();
    expect(state.isDeleting).toBe(false);
    expect(state.errorEvents).toEqual([]);
  });

  it("blocks deletion for archived threads", async () => {
    const { deps, state } = createDependencies({
      isArchivedThread: true,
    });

    await deleteWorkspaceMcpServerProfile(deps, "mcp-1");

    expect(state.workspaceError).toBe(MCP_PROFILE_ARCHIVED_THREAD_ERROR);
  });

  it("saves a duplicate MCP profile and emits the duplicate warning", async () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    const existing = createHttpServer({
      id: "mcp-existing",
      name: "Filesystem",
      url: "https://example.test/mcp",
    });
    const savedProfile = createHttpServer({
      id: "mcp-saved",
      name: "Filesystem Renamed",
      url: "https://example.test/mcp",
    });
    const { deps, state } = createDependencies({
      activeThread: createThreadState({
        mcpServers: [existing],
      }),
      saveMcpServerToConfig: vi.fn(async () => ({
        profile: savedProfile,
        warning: null,
      })),
    });

    await saveWorkspaceMcpServerProfile(deps);

    expect(state.connectedProfiles).toEqual([savedProfile]);
    expect(state.activeThread.mcpServers).toEqual([
      {
        ...existing,
        name: "Filesystem Renamed",
      },
    ]);
    expect(state.mcpFormWarning).toBe(
      'An MCP server with the same configuration already exists. Renamed it from "Filesystem" to "Filesystem Renamed".',
    );
    expect(state.warningEvents).toEqual(["mcp_server_duplicate_warning"]);
    expect(state.mcpFormError).toBeNull();
    expect(state.workspaceError).toBeNull();
    expect(state.resetFormCount).toBe(1);
    expect(state.editingMcpServerId).toBe("");
    expect(state.isSaving).toBe(false);
  });

  it("fails save when the edited profile is no longer available", async () => {
    const { deps, state } = createDependencies({
      workspaceProfiles: [],
      editingMcpServerId: "missing-server",
    });
    deps.mcpFormState.editingMcpServerId = "missing-server";

    await saveWorkspaceMcpServerProfile(deps);

    expect(state.mcpFormError).toBe(MCP_PROFILE_NOT_AVAILABLE_ERROR);
    expect(state.editingMcpServerId).toBe("");
  });
});
