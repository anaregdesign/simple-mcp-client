/**
 * Tests for Client thread guard selectors.
 */
import { describe, expect, it } from "vitest";
import {
  canSendMessageByGuard,
  selectThreadOperationPhaseFlags,
  shouldBlockThreadPersistence,
} from "~/lib/home/controller/thread-guards";

describe("selectThreadOperationPhaseFlags", () => {
  it("exposes phase booleans from a single selector", () => {
    expect(selectThreadOperationPhaseFlags("loading")).toEqual({
      isLoadingThreads: true,
      isSwitchingThread: false,
      isCreatingThread: false,
      isDeletingThread: false,
      isClearingThread: false,
      isRestoringThread: false,
      isThreadOperationBusy: true,
    });

    expect(selectThreadOperationPhaseFlags("idle").isThreadOperationBusy).toBe(false);
  });
});

describe("shouldBlockThreadPersistence", () => {
  it("blocks when sending and follows phase strategy", () => {
    expect(
      shouldBlockThreadPersistence({
        threadOperationPhase: "idle",
        isSending: true,
        blockOnCreating: false,
      }),
    ).toBe(true);

    expect(
      shouldBlockThreadPersistence({
        threadOperationPhase: "creating",
        isSending: false,
        blockOnCreating: false,
      }),
    ).toBe(false);

    expect(
      shouldBlockThreadPersistence({
        threadOperationPhase: "creating",
        isSending: false,
        blockOnCreating: true,
      }),
    ).toBe(true);
  });
});

describe("canSendMessageByGuard", () => {
  const baseInput = {
    threadOperationPhase: "idle" as const,
    isSending: false,
    isActiveThreadArchived: false,
    isChatLocked: false,
    isLoadingAzureConnections: false,
    isLoadingPlaygroundAzureDeployments: false,
    hasActiveThreadId: true,
    hasActivePlaygroundAzureConnection: true,
    hasSelectedPlaygroundAzureDeploymentName: true,
    isSelectedPlaygroundReasoningEffortOptionAvailable: true,
    isPlaygroundReasoningEffortWebSearchCompatible: true,
    hasDraftContent: true,
  };

  it("accepts the happy path", () => {
    expect(canSendMessageByGuard(baseInput)).toBe(true);
  });

  it.each([
    {
      label: "thread phase is busy",
      override: { threadOperationPhase: "loading" as const },
    },
    { label: "message is already sending", override: { isSending: true } },
    { label: "thread is archived", override: { isActiveThreadArchived: true } },
    { label: "chat is locked", override: { isChatLocked: true } },
    {
      label: "azure deployment list is loading",
      override: { isLoadingPlaygroundAzureDeployments: true },
    },
    {
      label: "reasoning effort option is unavailable",
      override: { isSelectedPlaygroundReasoningEffortOptionAvailable: false },
    },
    {
      label: "web search compatibility fails",
      override: { isPlaygroundReasoningEffortWebSearchCompatible: false },
    },
    { label: "no draft content", override: { hasDraftContent: false } },
  ])("rejects send when $label", ({ override }) => {
    expect(canSendMessageByGuard({ ...baseInput, ...override })).toBe(false);
  });
});
