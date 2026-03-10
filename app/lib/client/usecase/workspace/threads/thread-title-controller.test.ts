import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

vi.mock("~/lib/client/usecase/workspace/threads/thread-title-operations", () => ({
  refreshThreadTitleInBackground: vi.fn(async () => {}),
}));

import {
  refreshThreadTitleInBackground as refreshThreadTitleInBackgroundOperation,
} from "~/lib/client/usecase/workspace/threads/thread-title-operations";
import {
  createThreadTitleController,
} from "~/lib/client/usecase/workspace/threads/thread-title-controller";

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

describe("createThreadTitleController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assembles title refresh deps around the latest readers", async () => {
    const thread = createThreadState();
    let latestThreadById = new Map<string, ThreadState>([[thread.id, thread]]);
    let activeThreadId = "thread-1";
    let activeThreadNameInput = "Draft name";
    let activeAzureTenantId = "tenant-1";

    const controller = createThreadTitleController({
      readThreadById: (threadId) => latestThreadById.get(threadId),
      readActiveThreadId: () => activeThreadId,
      readActiveThreadNameInput: () => activeThreadNameInput,
      readActiveAzureTenantId: () => activeAzureTenantId,
      isArchivedThread: vi.fn(() => false),
      isChatLocked: false,
      isLoadingUtilityAzureDeployments: false,
      readActiveUtilityAzureConnection: () => ({
        projectName: "Utility Project",
        baseUrl: "https://example.openai.azure.com",
        apiVersion: "2026-01-01-preview",
      }),
      readSelectedUtilityAzureDeploymentName: () => "utility-deployment",
      isSelectedUtilityDeploymentAvailable: vi.fn(() => true),
      readAgentInstruction: () => "Current instruction",
      isUtilityReasoningEffortSupported: true,
      readEffectiveUtilityReasoningEffort: () => "high",
      generateTitle: vi.fn(async () => ({ title: "Renamed Thread" })),
      updateThreadStateById: vi.fn(),
      setActiveThreadNameInput: vi.fn(),
      saveActiveThreadNameInBackground: vi.fn(async () => {}),
      isSwitchingAzureTenant: false,
      reportAzureTenantSwitchPending: vi.fn(),
      logClientError: vi.fn(),
    });

    activeThreadId = "thread-2";
    activeThreadNameInput = "Next draft name";
    activeAzureTenantId = "tenant-2";
    const nextThread = createThreadState({ id: "thread-1", name: "Thread 1 next" });
    latestThreadById = new Map<string, ThreadState>([[nextThread.id, nextThread]]);

    await controller.refreshThreadTitleInBackground({
      threadId: "thread-1",
      reason: "first_message",
    });

    expect(refreshThreadTitleInBackgroundOperation).toHaveBeenCalledTimes(1);
    const deps =
      vi.mocked(refreshThreadTitleInBackgroundOperation).mock.calls[0]?.[0];
    expect(deps?.readActiveThreadId()).toBe("thread-2");
    expect(deps?.readActiveThreadNameInput()).toBe("Next draft name");
    expect(deps?.readActiveAzureTenantId()).toBe("tenant-2");
    expect(deps?.readThreadById("thread-1")).toEqual(nextThread);
    expect(deps?.readSelectedUtilityAzureDeploymentName()).toBe(
      "utility-deployment",
    );
    expect(deps?.readEffectiveUtilityReasoningEffort()).toBe("high");
  });
});
