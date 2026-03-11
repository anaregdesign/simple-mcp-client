import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

vi.mock("~/lib/client/usecase/workspace/chat-session/operations", () => ({
  sendMessage: vi.fn(async () => {}),
}));

vi.mock("~/lib/client/usecase/workspace/chat-session/send-message-transport", () => ({
  executeSendMessageTransport: vi.fn(async () => ({
    assistantMessage: {
      id: "assistant-1",
      role: "assistant",
      content: "assistant response",
      createdAt: "2026-01-01T00:00:00.000Z",
      turnId: "turn-1",
      attachments: [],
      skillActivations: [],
    },
    threadEnvironment: {},
    operationLogCount: 0,
    usedEventStream: false,
  })),
}));

import {
  sendMessage as sendMessageOperation,
} from "~/lib/client/usecase/workspace/chat-session/operations";
import {
  executeSendMessageTransport,
} from "~/lib/client/usecase/workspace/chat-session/send-message-transport";
import {
  createSendMessageController,
} from "~/lib/client/usecase/workspace/chat-session/controller";

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

describe("createSendMessageController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assembles send-message deps around current readers and transport adapters", async () => {
    const state = {
      activeThreadId: "thread-1",
      activeAzureTenantId: "tenant-1",
      threads: [createThreadState()],
    };
    const sendMessageGateway = vi.fn(async () => ({
      response: new Response(null, { status: 200 }),
      payload: {
        assistantMessage: {
          id: "assistant-1",
          role: "assistant",
          content: "assistant response",
          createdAt: "2026-01-01T00:00:00.000Z",
          turnId: "turn-1",
          attachments: [],
          skillActivations: [],
        } satisfies ThreadMessage,
        threadEnvironment: {},
      },
      isEventStream: false,
      operationLogCount: 0,
    }));
    const markAzureAuthRequired = vi.fn();
    const saveThreadStateToDatabase = vi.fn(async () => true);

    const controller = createSendMessageController({
      readActiveThreadId: () => state.activeThreadId,
      readActiveAzureTenantId: () => state.activeAzureTenantId,
      readBaseThread: (threadId) =>
        state.threads.find((thread) => thread.id === threadId) ?? null,
      readDraft: () => "hello",
      readSelectedPlaygroundAzureDeploymentName: () => "gpt-5",
      isArchivedThread: vi.fn(() => false),
      readThreadRequestState: vi.fn(() => ({
        isSending: false,
        sendProgressMessages: [],
        activeTurnId: null,
        lastErrorTurnId: null,
        error: null,
      })),
      readThreadOperationPhase: () => "idle",
      isChatLocked: false,
      readActivePlaygroundAzureConnection: () => ({
        id: "project-1",
        projectName: "Playground",
        baseUrl: "https://example.openai.azure.com",
        apiVersion: "2026-01-01-preview",
      }),
      isAzureAuthRequired: false,
      isLoadingPlaygroundAzureDeployments: false,
      isSelectedPlaygroundDeploymentAvailable: vi.fn(() => true),
      isPlaygroundReasoningEffortSupported: true,
      isSelectedPlaygroundReasoningEffortOptionAvailable: vi.fn(() => true),
      readReasoningEffort: () => "medium",
      readWebSearchEnabled: () => false,
      readDraftAttachments: () => [],
      readMessages: () => [],
      readMcpServers: () => [],
      readSelectedMessageSkillActivations: () => [],
      readSelectedThreadSkills: () => [],
      readAgentInstruction: () => "Keep responses concise.",
      readInstructionContextToggles: () => ({ system: true }),
      setThreadError: vi.fn(),
      setUiError: vi.fn(),
      setActiveMainTab: vi.fn(),
      appendMessageToThreadState: vi.fn(),
      setDraft: vi.fn(),
      setSelectedMessageSkillActivations: vi.fn(),
      setDraftAttachments: vi.fn(),
      setChatAttachmentError: vi.fn(),
      setSystemNotice: vi.fn(),
      clearAzureSessionStatus: vi.fn(),
      updateThreadRequestState: vi.fn(),
      logClientInfo: vi.fn(),
      logClientError: vi.fn(),
      refreshThreadTitleInBackground: vi.fn(),
      assignThreadSendAbortController: vi.fn(),
      saveThreadStateToDatabase,
      markAzureAuthRequired,
      sendMessage: sendMessageGateway,
      appendThreadProgressMessage: vi.fn(),
      appendThreadOperationLogToThreadState: vi.fn(),
      applyThreadEnvironmentToThreadState: vi.fn(),
      clearThreadSendAbortController: vi.fn(),
      scheduleThreadStateSave: vi.fn(),
    });

    await controller.sendMessage();

    expect(sendMessageOperation).toHaveBeenCalledTimes(1);
    const deps = vi.mocked(sendMessageOperation).mock.calls[0]?.[0];
    expect(deps?.readActiveThreadId()).toBe("thread-1");
    expect(deps?.readActiveAzureTenantId()).toBe("tenant-1");
    expect(deps?.readSelectedPlaygroundAzureDeploymentName()).toBe("gpt-5");
    expect(deps?.readBaseThread("thread-1")?.id).toBe("thread-1");
    expect(deps?.createTurnId()).toMatch(/^turn-/);

    const transportOptions = {
      requestPayload: {
        threadId: "thread-1",
        turnId: "turn-1",
      },
      requestThreadEnvironment: {},
      signal: new AbortController().signal,
      onProgress: vi.fn(),
      onOperationLogRecord: vi.fn(),
    };
    await deps?.sendMessageTransport(transportOptions);

    expect(executeSendMessageTransport).toHaveBeenCalledWith(
      {
        sendMessage: sendMessageGateway,
        markAzureAuthRequired,
      },
      transportOptions,
    );
    expect(deps?.saveThreadStateToDatabase).toBe(saveThreadStateToDatabase);
  });
});
