import { describe, expect, it, vi } from "vitest";
import { createThreadRequestStateController } from "~/lib/client/usecase/workspace/threads/request-state";

describe("threads/request-state", () => {
  it("updates request state through the reducer action", () => {
    const dispatchWorkspaceInteraction = vi.fn();
    const controller = createThreadRequestStateController({
      threadRequestStateByIdRef: {
        current: {
          "thread-1": {
            isSending: false,
            sendProgressMessages: [],
            activeTurnId: null,
            lastErrorTurnId: null,
            error: null,
          },
        },
      },
      threadSendAbortControllerByIdRef: { current: new Map() },
      dispatchWorkspaceInteraction,
    });

    controller.updateThreadRequestState("thread-1", (current) => ({
      ...current,
      isSending: true,
    }));

    expect(dispatchWorkspaceInteraction).toHaveBeenCalledWith({
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
    const states: Record<string, any> = {
      "thread-1": {
        isSending: true,
        sendProgressMessages: ["already there"],
        activeTurnId: null,
        lastErrorTurnId: null,
        error: null,
      },
    };

    const controller = createThreadRequestStateController({
      threadRequestStateByIdRef: { current: states },
      threadSendAbortControllerByIdRef: { current: new Map() },
      dispatchWorkspaceInteraction: vi.fn((action) => {
        if (action.type === "thread_request_state/set") {
          states[action.threadId] = action.nextState;
        }
      }),
    });

    controller.appendThreadProgressMessage("thread-1", "already there");
    expect(states["thread-1"].sendProgressMessages).toEqual(["already there"]);

    for (let index = 0; index < 10; index += 1) {
      controller.appendThreadProgressMessage("thread-1", `step-${index}`);
    }

    expect(states["thread-1"].sendProgressMessages).toEqual([
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
    const states: Record<string, any> = {
      "thread-1": {
        isSending: true,
        sendProgressMessages: ["working"],
        activeTurnId: "turn-1",
        lastErrorTurnId: "turn-0",
        error: "error",
      },
    };

    const controller = createThreadRequestStateController({
      threadRequestStateByIdRef: { current: states },
      threadSendAbortControllerByIdRef: {
        current: new Map([["thread-1", abortController]]),
      },
      dispatchWorkspaceInteraction: vi.fn((action) => {
        if (action.type === "thread_request_state/set") {
          states[action.threadId] = action.nextState;
        }
      }),
    });

    expect(controller.cancelThreadInProgressProcessing("thread-1")).toBe(true);
    expect(abortController.signal.aborted).toBe(true);
    expect(states["thread-1"]).toEqual({
      isSending: false,
      sendProgressMessages: [],
      activeTurnId: null,
      lastErrorTurnId: null,
      error: null,
    });
  });
});
