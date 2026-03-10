import { describe, expect, it, vi } from "vitest";
import { createThreadRequestStateController } from "~/lib/client/usecase/workspace/threads/thread-request-state-controller";
import type { ThreadRequestState } from "~/lib/client/usecase/workspace/threads/thread-request-state";

describe("threads/thread-request-state-controller", () => {
  it("updates request state through the reducer action", () => {
    const dispatchThreadRequestState = vi.fn();
    const threadRequestStateById: Record<string, ThreadRequestState> = {
      "thread-1": {
        isSending: false,
        sendProgressMessages: [],
        activeTurnId: null,
        lastErrorTurnId: null,
        error: null,
      },
    };
    const threadSendAbortControllerById = new Map<string, AbortController>();
    const controller = createThreadRequestStateController({
      readThreadRequestStateByIdRecord: () => threadRequestStateById,
      readThreadSendAbortController: (threadId) =>
        threadSendAbortControllerById.get(threadId),
      writeThreadSendAbortController: (threadId, abortController) => {
        threadSendAbortControllerById.set(threadId, abortController);
      },
      clearThreadSendAbortControllerEntry: (threadId) => {
        threadSendAbortControllerById.delete(threadId);
      },
      dispatchThreadRequestState,
    });

    controller.updateThreadRequestState("thread-1", (current) => ({
      ...current,
      isSending: true,
    }));

    expect(dispatchThreadRequestState).toHaveBeenCalledWith({
      type: "thread_request_state/set",
      threadId: "thread-1",
      nextState: {
        isSending: true,
        sendProgressMessages: [],
        activeTurnId: null,
        lastErrorTurnId: null,
        error: null,
      },
    });
  });

  it("deduplicates trailing progress messages and caps history", () => {
    const threadRequestStateById: Record<string, ThreadRequestState> = {
      "thread-1": {
        isSending: true,
        sendProgressMessages: ["already there"],
        activeTurnId: null,
        lastErrorTurnId: null,
        error: null,
      },
    };
    const threadSendAbortControllerById = new Map<string, AbortController>();

    const controller = createThreadRequestStateController({
      readThreadRequestStateByIdRecord: () => threadRequestStateById,
      readThreadSendAbortController: (threadId) =>
        threadSendAbortControllerById.get(threadId),
      writeThreadSendAbortController: (threadId, abortController) => {
        threadSendAbortControllerById.set(threadId, abortController);
      },
      clearThreadSendAbortControllerEntry: (threadId) => {
        threadSendAbortControllerById.delete(threadId);
      },
      dispatchThreadRequestState: vi.fn((action) => {
        if (action.type === "thread_request_state/set") {
          threadRequestStateById[action.threadId] = action.nextState;
        }
      }),
    });

    controller.appendThreadProgressMessage("thread-1", "already there");
    expect(threadRequestStateById["thread-1"]?.sendProgressMessages).toEqual([
      "already there",
    ]);

    for (let index = 0; index < 10; index += 1) {
      controller.appendThreadProgressMessage("thread-1", `step-${index}`);
    }

    expect(threadRequestStateById["thread-1"]?.sendProgressMessages).toEqual([
      "step-2",
      "step-3",
      "step-4",
      "step-5",
      "step-6",
      "step-7",
      "step-8",
      "step-9",
    ]);
  });

  it("cancels the active send request and clears the state", () => {
    const abortController = new AbortController();
    const threadRequestStateById: Record<string, ThreadRequestState> = {
      "thread-1": {
        isSending: true,
        sendProgressMessages: ["working"],
        activeTurnId: "turn-1",
        lastErrorTurnId: "turn-0",
        error: "error",
      },
    };
    const threadSendAbortControllerById = new Map<string, AbortController>([
      ["thread-1", abortController],
    ]);

    const controller = createThreadRequestStateController({
      readThreadRequestStateByIdRecord: () => threadRequestStateById,
      readThreadSendAbortController: (threadId) =>
        threadSendAbortControllerById.get(threadId),
      writeThreadSendAbortController: (threadId, nextAbortController) => {
        threadSendAbortControllerById.set(threadId, nextAbortController);
      },
      clearThreadSendAbortControllerEntry: (threadId) => {
        threadSendAbortControllerById.delete(threadId);
      },
      dispatchThreadRequestState: vi.fn((action) => {
        if (action.type === "thread_request_state/set") {
          threadRequestStateById[action.threadId] = action.nextState;
        }
      }),
    });

    expect(controller.cancelThreadInProgressProcessing("thread-1")).toBe(true);
    expect(abortController.signal.aborted).toBe(true);
    expect(threadRequestStateById["thread-1"]).toEqual({
      isSending: false,
      sendProgressMessages: [],
      activeTurnId: null,
      lastErrorTurnId: null,
      error: null,
    });
    expect(threadSendAbortControllerById.has("thread-1")).toBe(false);
  });
});
