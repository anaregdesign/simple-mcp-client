import { describe, expect, it, vi } from "vitest";
import { ClientApiError } from "~/lib/client/infrastructure/api/api-client";
import type { ThreadTitleSuggestionRequest } from "~/lib/client/infrastructure/api/thread-title-api-client";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadState } from "~/lib/contracts/threads/types";
import { refreshThreadTitleInBackground } from "./thread-title-operations";

function createThreadMessage(
  content: string,
  overrides: Partial<ThreadMessage> = {},
): ThreadMessage {
  return {
    id: "message-1",
    role: "user",
    content,
    createdAt: "2026-01-01T00:00:00.000Z",
    turnId: "turn-1",
    attachments: [],
    skillActivations: [],
    ...overrides,
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
    messages: [createThreadMessage("Explain the routing refactor plan.")],
    mcpServers: [],
    mcpRpcLogs: [],
    skillSelections: [],
    ...overrides,
  };
}

function createDependencies(
  overrides: {
    generateTitle?: (
      request: ThreadTitleSuggestionRequest,
    ) => Promise<{ title?: string }>;
  } = {},
) {
  const state = {
    activeThreadId: "thread-1",
    activeThreadNameInput: "Thread 1",
    agentInstruction: "Instruction",
    activeAzureTenantId: "tenant-1",
    activeUtilityAzureConnection: {
      projectName: "Utility Project",
      baseUrl: "https://example.openai.azure.com",
      apiVersion: "2026-01-01-preview",
    },
    selectedUtilityAzureDeploymentName: "utility-deployment",
    threads: [
      createThreadState(),
      createThreadState({
        id: "thread-2",
        name: "Thread 2",
        agentInstruction: "Secondary instruction",
      }),
    ] as ThreadState[],
    savedTitles: [] as Array<{ threadId: string; name: string }>,
    reportedTenantSwitchPendingCount: 0,
    errorEvents: [] as string[],
  };

  const updateThreadStateById = vi.fn(
    (threadId: string, updater: (current: ThreadState) => ThreadState) => {
      state.threads = state.threads.map((thread) =>
        thread.id === threadId ? updater(thread) : thread,
      );
    },
  );
  const saveActiveThreadNameInBackground = vi.fn(
    async (threadId: string, name: string) => {
      state.savedTitles.push({ threadId, name });
    },
  );
  const generateTitle =
    overrides.generateTitle ??
    vi.fn(async () => ({
      title: '"Refactor plan"',
    }));

  const deps = {
    isArchivedThread: () => false,
    isChatLocked: false,
    isLoadingUtilityAzureDeployments: false,
    readActiveUtilityAzureConnection: () => state.activeUtilityAzureConnection,
    readSelectedUtilityAzureDeploymentName: () =>
      state.selectedUtilityAzureDeploymentName,
    isSelectedUtilityDeploymentAvailable: (deploymentName: string) =>
      deploymentName === state.selectedUtilityAzureDeploymentName,
    readThreadById: (threadId: string) =>
      state.threads.find((thread) => thread.id === threadId),
    readActiveThreadId: () => state.activeThreadId,
    readActiveThreadNameInput: () => state.activeThreadNameInput,
    readAgentInstruction: () => state.agentInstruction,
    readActiveAzureTenantId: () => state.activeAzureTenantId,
    isUtilityReasoningEffortSupported: true,
    readEffectiveUtilityReasoningEffort: () => "high" as const,
    generateTitle,
    updateThreadStateById,
    setActiveThreadNameInput: (value: string) => {
      state.activeThreadNameInput = value;
    },
    saveActiveThreadNameInBackground,
    isSwitchingAzureTenant: false,
    reportAzureTenantSwitchPending: () => {
      state.reportedTenantSwitchPendingCount += 1;
    },
    logClientError: (eventName: string) => {
      state.errorEvents.push(eventName);
    },
  };

  return { deps, state, updateThreadStateById, saveActiveThreadNameInBackground };
}

describe("thread-title-operations", () => {
  it("generates and persists a normalized title for the active thread", async () => {
    const { deps, state, saveActiveThreadNameInBackground } =
      createDependencies();

    await refreshThreadTitleInBackground(deps, {
      threadId: "thread-1",
      reason: "first_message",
    });

    expect(deps.generateTitle).toHaveBeenCalledWith(
      expect.objectContaining({
        instruction: "Instruction",
        azureConfig: expect.objectContaining({
          deploymentName: "utility-deployment",
          tenantId: "tenant-1",
        }),
      }),
    );
    expect(state.threads[0]?.name).toBe("Refactor plan");
    expect(state.activeThreadNameInput).toBe("Refactor plan");
    expect(saveActiveThreadNameInBackground).toHaveBeenCalledWith(
      "thread-1",
      "Refactor plan",
    );
  });

  it("reports pending tenant switching for auth_required title requests", async () => {
    const generateTitle = vi.fn(async () => {
      throw new ClientApiError({
        kind: "auth_required",
        status: 401,
        message: "Azure login is required.",
      });
    });
    const { deps, state } = createDependencies({
      generateTitle,
    });
    deps.isSwitchingAzureTenant = true;

    await refreshThreadTitleInBackground(deps, {
      threadId: "thread-1",
      reason: "utility_deployment_update",
    });

    expect(state.reportedTenantSwitchPendingCount).toBe(1);
    expect(state.errorEvents).toEqual([]);
  });

  it("skips persistence when the suggested title already matches state", async () => {
    const { deps, state, updateThreadStateById, saveActiveThreadNameInBackground } =
      createDependencies({
        generateTitle: vi.fn(async () => ({
          title: "Thread 1",
        })),
      });

    await refreshThreadTitleInBackground(deps, {
      threadId: "thread-1",
      reason: "instruction_update",
    });

    expect(state.threads[0]?.name).toBe("Thread 1");
    expect(updateThreadStateById).not.toHaveBeenCalled();
    expect(saveActiveThreadNameInBackground).not.toHaveBeenCalled();
  });
});
