import { describe, expect, it, vi } from "vitest";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadRequestState } from "~/lib/client/usecase/workspace/types";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";
import { sendMessage as sendMessageOperation } from "./operations";

function createThreadState(overrides: Partial<ThreadState> = {}): ThreadState {
  return {
    id: "thread-1",
    name: "Thread 1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "high",
    webSearchEnabled: false,
    chatAzureConfig: null,
    agentConversationId: null,
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

function createAssistantMessage(
  overrides: Partial<ThreadMessage> = {},
): ThreadMessage {
  return {
    id: "assistant-1",
    role: "assistant",
    content: "assistant response",
    createdAt: "2026-01-01T00:00:02.000Z",
    turnId: "turn-1",
    attachments: [],
    skillActivations: [],
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
    saveThreadStateToDatabase?: (
      thread: ThreadState,
      signature: string,
    ) => Promise<boolean>;
    assignThreadSendAbortController?: (
      threadId: string,
      controller: AbortController,
    ) => void;
    sendMessageTransport?: (options: {
      signal: AbortSignal;
    }) => Promise<{
      assistantMessage: ThreadMessage;
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
      id: "project-1",
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
    flow: [] as string[],
    savedSnapshots: [] as ThreadState[],
  };

  const sendMessageTransport =
    overrides.sendMessageTransport ??
    vi.fn(async () => ({
      assistantMessage: createAssistantMessage(),
      threadEnvironment: {
        FOO: "bar",
      },
      operationLogCount: 2,
      usedEventStream: false,
    }));

  const saveThreadStateToDatabase =
    overrides.saveThreadStateToDatabase ??
    vi.fn(async (thread: ThreadState) => {
      state.flow.push("save");
      state.savedSnapshots.push(thread);
      state.baseThread = thread;
      state.messages = [...thread.messages];
      state.threadMessages = [...thread.messages];
      return true;
    });

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
    saveThreadStateToDatabase: async (thread: ThreadState, signature: string) =>
      saveThreadStateToDatabase(thread, signature),
    sendMessageTransport: async (options: { signal: AbortSignal }) => {
      state.flow.push("send");
      return await sendMessageTransport(options);
    },
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

  return {
    deps,
    state,
    saveThreadStateToDatabase,
    sendMessageTransport,
  };
}

describe("send-message-operations", () => {
  it("persists the thread snapshot before sending and applies the server message", async () => {
    const { deps, state, saveThreadStateToDatabase, sendMessageTransport } =
      createDependencies();

    await sendMessageOperation(deps);

    expect(saveThreadStateToDatabase).toHaveBeenCalledTimes(1);
    expect(sendMessageTransport).toHaveBeenCalledTimes(1);
    expect(state.flow).toEqual(["save", "send"]);
    expect(state.savedSnapshots[0]?.messages.map((message) => message.role)).toEqual([
      "user",
    ]);
    expect(state.threadMessages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
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

  it("does not start transport when the pre-send save fails", async () => {
    const { deps, state, sendMessageTransport } = createDependencies({
      saveThreadStateToDatabase: vi.fn(async () => false),
    });

    await sendMessageOperation(deps);

    expect(sendMessageTransport).not.toHaveBeenCalled();
    expect(state.draft).toBe("hello from the workspace");
    expect(state.threadMessages).toEqual([]);
    expect(state.infoEvents).toEqual([]);
    expect(state.requestState).toEqual(createThreadRequestState());
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
  });

  it("handles aborted requests as cancellation after the snapshot is saved", async () => {
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
