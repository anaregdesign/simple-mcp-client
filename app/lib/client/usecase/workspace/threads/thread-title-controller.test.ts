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

  it("assembles title refresh deps around the current refs", async () => {
    const thread = createThreadState();
    const activeThreadIdRef = { current: "thread-1" };
    const activeThreadNameInputRef = { current: "Draft name" };
    const activeAzureTenantIdRef = { current: "tenant-1" };
    const threadsRef = { current: [thread] };

    const controller = createThreadTitleController({
      activeThreadIdRef,
      activeThreadNameInputRef,
      activeAzureTenantIdRef,
      threadsRef,
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

    await controller.refreshThreadTitleInBackground({
      threadId: "thread-1",
      reason: "first_message",
    });

    expect(refreshThreadTitleInBackgroundOperation).toHaveBeenCalledTimes(1);
    const deps =
      vi.mocked(refreshThreadTitleInBackgroundOperation).mock.calls[0]?.[0];
    expect(deps?.readActiveThreadId()).toBe("thread-1");
    expect(deps?.readActiveThreadNameInput()).toBe("Draft name");
    expect(deps?.readActiveAzureTenantId()).toBe("tenant-1");
    expect(deps?.readThreadById("thread-1")).toEqual(thread);
    expect(deps?.readSelectedUtilityAzureDeploymentName()).toBe(
      "utility-deployment",
    );
    expect(deps?.readEffectiveUtilityReasoningEffort()).toBe("high");
  });
});
