import { describe, expect, it } from "vitest";
import {
  createInitialThreadRequestStateCollection,
  readThreadRequestStateById,
  threadRequestStateReducer,
} from "~/lib/client/usecase/workspace/threads/thread-request-state-store";

describe("threads/thread-request-state-store", () => {
  it("sets and reads thread request state by trimmed thread id", () => {
    const nextState = threadRequestStateReducer(
      createInitialThreadRequestStateCollection(),
      {
        type: "thread_request_state/set",
        threadId: " thread-1 ",
        nextState: {
          isSending: true,
          sendProgressMessages: ["Sending..."],
          activeTurnId: "turn-1",
          lastErrorTurnId: null,
          error: null,
        },
      },
    );

    expect(readThreadRequestStateById(nextState, "thread-1")).toEqual({
      isSending: true,
      sendProgressMessages: ["Sending..."],
      activeTurnId: "turn-1",
      lastErrorTurnId: null,
      error: null,
    });
  });

  it("removes and resets thread request state", () => {
    const populatedState = threadRequestStateReducer(
      createInitialThreadRequestStateCollection(),
      {
        type: "thread_request_state/set",
        threadId: "thread-1",
        nextState: {
          isSending: true,
          sendProgressMessages: [],
          activeTurnId: null,
          lastErrorTurnId: null,
          error: null,
        },
      },
    );

    const removedState = threadRequestStateReducer(populatedState, {
      type: "thread_request_state/remove",
      threadId: "thread-1",
    });
    expect(removedState.threadRequestStateById).toEqual({});

    const resetState = threadRequestStateReducer(populatedState, {
      type: "thread_request_state/reset_all",
    });
    expect(resetState).toEqual(createInitialThreadRequestStateCollection());
  });

  it("prunes request state for removed threads", () => {
    const initialState = {
      threadRequestStateById: {
        "thread-1": {
          isSending: true,
          sendProgressMessages: [],
          activeTurnId: null,
          lastErrorTurnId: null,
          error: null,
        },
        "thread-2": {
          isSending: false,
          sendProgressMessages: [],
          activeTurnId: null,
          lastErrorTurnId: "turn-2",
          error: "boom",
        },
      },
    };

    const nextState = threadRequestStateReducer(initialState, {
      type: "thread_request_state/prune",
      validThreadIds: ["thread-2"],
    });

    expect(nextState.threadRequestStateById).toEqual({
      "thread-2": initialState.threadRequestStateById["thread-2"],
    });
  });
});
