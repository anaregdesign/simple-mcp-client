import { describe, expect, it, vi } from "vitest";
import type { ThreadMessage } from "~/lib/client/chat/messages";
import type { ThreadRequestState } from "~/lib/client/usecase/workspace/types";
import type { ThreadState } from "~/lib/contracts/threads/types";
import { sendMessage as sendMessageOperation } from "./send-message-operations";

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

function createThreadRequestState(): ThreadRequestState {
  return {
    isSending: false,
    sendProgressMessages: [],
    activeTurnId: null,
    lastErrorTurnId: null,
    error: null,
  };
}

function createDependencies(
  overrides: {
    isChatLocked?: boolean;
    assignThreadSendAbortController?: (
      threadId: string,
      controller: AbortController,
    ) => void;
    sendMessageTransport?: (options: {
      signal: AbortSignal;
    }) => Promise<{
      assistantMessage: string;
      threadEnvironment: Record<string, string>;
      operationLogCount: number;
      usedEventStream: boolean;
    }>;
  } = {},
) {
  const state = {
    activeThreadId: "thread-1",
    draft: "hello from the workspace",
    selectedPlaygroundAzureDeploymentName: "gpt-5",
    threadOperationPhase: "idle" as const,
    activePlaygroundAzureConnection: {
      projectName: "Playground",
      baseUrl: "https://example.openai.azure.com",
      apiVersion: "2026-01-01-preview",
    },
    reasoningEffort: "medium" as const,
    webSearchEnabled: false,
    baseThread: createThreadState(),
    draftAttachments: [] as Array<{
      id: string;
      name: string;
      mimeType: string;
      sizeBytes: number;
      dataUrl: string;
    }>,
    messages: [] as ThreadMessage[],
    mcpServers: [],
    selectedMessageSkillActivations: [] as Array<{
      name: string;
      location: string;
    }>,
    selectedThreadSkills: [] as Array<{
      name: string;
      location: string;
    }>,
    agentInstruction: "Keep responses concise.",
    instructionContextToggles: {
      system: true,
    },
    activeAzureTenantId: "tenant-1",
    threadError: null as string | null,
    uiError: null as string | null,
    activeMainTab: null as "threads" | "settings" | "skills" | "mcp" | null,
    threadMessages: [] as ThreadMessage[],
    chatAttachmentError: "stale" as string | null,
    systemNotice: "notice" as string | null,
    azureSessionStatusCleared: 0,
    requestState: createThreadRequestState(),
    infoEvents: [] as string[],
    errorEvents: [] as string[],
    refreshTitleCalls: [] as Array<{ threadId: string; reason: string }>,
    appliedThreadEnvironment: null as Record<string, string> | null,
    progressMessages: [] as string[],
    operationLogTurnIds: [] as string[],
    clearedControllers: 0,
    scheduledThreadSaves: [] as string[],
  };

  const sendMessageTransport =
    overrides.sendMessageTransport ??
    vi.fn(async () => ({
      assistantMessage: "assistant response",
      threadEnvironment: {
        FOO: "bar",
      },
      operationLogCount: 2,
      usedEventStream: false,
    }));

  const deps = {
    readActiveThreadId: () => state.activeThreadId,
    readDraft: () => state.draft,
    readSelectedPlaygroundAzureDeploymentName: () =>
      state.selectedPlaygroundAzureDeploymentName,
    isArchivedThread: () => false,
    readThreadRequestState: () => state.requestState,
    readThreadOperationPhase: () => state.threadOperationPhase,
    isChatLocked: overrides.isChatLocked ?? false,
    readActivePlaygroundAzureConnection: () =>
      state.activePlaygroundAzureConnection,
    isAzureAuthRequired: false,
    isLoadingPlaygroundAzureDeployments: false,
    isSelectedPlaygroundDeploymentAvailable: () => true,
    isPlaygroundReasoningEffortSupported: true,
    isSelectedPlaygroundReasoningEffortOptionAvailable: () => true,
    readReasoningEffort: () => state.reasoningEffort,
    readWebSearchEnabled: () => state.webSearchEnabled,
    readBaseThread: () => state.baseThread,
    readDraftAttachments: () => state.draftAttachments,
    readMessages: () => state.messages,
    readMcpServers: () => state.mcpServers,
    readSelectedMessageSkillActivations: () =>
      state.selectedMessageSkillActivations,
    readSelectedThreadSkills: () => state.selectedThreadSkills,
    readAgentInstruction: () => state.agentInstruction,
    readInstructionContextToggles: () => state.instructionContextToggles,
    readActiveAzureTenantId: () => state.activeAzureTenantId,
    createTurnId: () => "turn-1",
    setThreadError: (value: string | null) => {
      state.threadError = value;
    },
    setUiError: (value: string | null) => {
      state.uiError = value;
    },
    setActiveMainTab: (tab: "threads" | "settings" | "skills" | "mcp") => {
      state.activeMainTab = tab;
    },
    appendMessageToThreadState: (_threadId: string, message: ThreadMessage) => {
      state.threadMessages.push(message);
    },
    setDraft: (value: string) => {
      state.draft = value;
    },
    setSelectedMessageSkillActivations: (value: Array<{
      name: string;
      location: string;
    }>) => {
      state.selectedMessageSkillActivations = value;
    },
    setDraftAttachments: (
      value: Array<{
        id: string;
        name: string;
        mimeType: string;
        sizeBytes: number;
        dataUrl: string;
      }>,
    ) => {
      state.draftAttachments = value;
    },
    setChatAttachmentError: (value: string | null) => {
      state.chatAttachmentError = value;
    },
    setSystemNotice: (value: string | null) => {
      state.systemNotice = value;
    },
    clearAzureSessionStatus: () => {
      state.azureSessionStatusCleared += 1;
    },
    updateThreadRequestState: (
      _threadId: string,
      updater: (current: ThreadRequestState) => ThreadRequestState,
    ) => {
      state.requestState = updater(state.requestState);
    },
    logClientInfo: (eventName: string) => {
      state.infoEvents.push(eventName);
    },
    logClientError: (eventName: string) => {
      state.errorEvents.push(eventName);
    },
    refreshThreadTitleInBackground: (options: {
      threadId: string;
      reason: "first_message";
    }) => {
      state.refreshTitleCalls.push(options);
    },
    assignThreadSendAbortController:
      overrides.assignThreadSendAbortController ?? vi.fn(),
    sendMessageTransport: (options: {
      signal: AbortSignal;
    }) => sendMessageTransport(options),
    appendThreadProgressMessage: (_threadId: string, message: string) => {
      state.progressMessages.push(message);
    },
    appendThreadOperationLogToThreadState: (
      _threadId: string,
      entry: { turnId?: string | null },
    ) => {
      state.operationLogTurnIds.push(entry.turnId ?? "");
    },
    applyThreadEnvironmentToThreadState: (
      _threadId: string,
      environment: Record<string, string>,
    ) => {
      state.appliedThreadEnvironment = environment;
    },
    clearThreadSendAbortController: () => {
      state.clearedControllers += 1;
    },
    scheduleThreadStateSave: (threadId: string) => {
      state.scheduledThreadSaves.push(threadId);
    },
  };

  return { deps, state, sendMessageTransport };
}

describe("send-message-operations", () => {
  it("executes the send flow and settles success state", async () => {
    const { deps, state, sendMessageTransport } = createDependencies();

    await sendMessageOperation(deps);

    expect(sendMessageTransport).toHaveBeenCalledTimes(1);
    expect(state.threadMessages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(state.threadMessages[1]?.content).toBe("assistant response");
    expect(state.draft).toBe("");
    expect(state.chatAttachmentError).toBeNull();
    expect(state.systemNotice).toBeNull();
    expect(state.azureSessionStatusCleared).toBe(1);
    expect(state.requestState).toEqual(createThreadRequestState());
    expect(state.refreshTitleCalls).toEqual([
      {
        threadId: "thread-1",
        reason: "first_message",
      },
    ]);
    expect(state.appliedThreadEnvironment).toEqual({
      FOO: "bar",
    });
    expect(state.infoEvents).toEqual([
      "send_message_started",
      "send_message_succeeded",
    ]);
    expect(state.errorEvents).toEqual([]);
    expect(state.scheduledThreadSaves).toEqual(["thread-1"]);
  });

  it("maps precondition violations to UI state without sending", async () => {
    const { deps, state, sendMessageTransport } = createDependencies({
      isChatLocked: true,
    });

    await sendMessageOperation(deps);

    expect(sendMessageTransport).not.toHaveBeenCalled();
    expect(state.uiError).toBe(
      "Playground is unavailable while logged out. Open ⚙️ Settings and sign in.",
    );
    expect(state.activeMainTab).toBe("settings");
    expect(state.threadMessages).toEqual([]);
    expect(state.infoEvents).toEqual([]);
  });

  it("handles aborted requests as cancellation", async () => {
    const { deps, state, sendMessageTransport } = createDependencies({
      assignThreadSendAbortController: (_threadId, controller) => {
        controller.abort();
      },
      sendMessageTransport: vi.fn(async ({ signal }) => {
        expect(signal.aborted).toBe(true);
        throw new Error("aborted");
      }),
    });

    await sendMessageOperation(deps);

    expect(sendMessageTransport).toHaveBeenCalledTimes(1);
    expect(state.threadMessages.map((message) => message.role)).toEqual([
      "user",
    ]);
    expect(state.requestState).toEqual(createThreadRequestState());
    expect(state.infoEvents).toEqual([
      "send_message_started",
      "send_message_canceled",
    ]);
    expect(state.errorEvents).toEqual([]);
    expect(state.scheduledThreadSaves).toEqual(["thread-1"]);
  });
});
