/**
 * Tests for thread-management reducer transitions.
 */
import { describe, expect, it } from "vitest";
import { threadManagementReducer } from "~/lib/client/usecase/workspace/thread-management/reducer";
import { initialThreadManagementState } from "~/lib/client/usecase/workspace/thread-management/state";

describe("threadManagementReducer", () => {
  it("starts rename mode with the selected thread values", () => {
    expect(
      threadManagementReducer(initialThreadManagementState, {
        type: "renameStarted",
        threadId: "thread-1",
        threadName: "Thread 1",
      }),
    ).toEqual({
      renamingThreadId: "thread-1",
      renamingThreadName: "Thread 1",
    });
  });

  it("updates only the rename input value", () => {
    expect(
      threadManagementReducer(
        {
          renamingThreadId: "thread-1",
          renamingThreadName: "Thread 1",
        },
        {
          type: "renameNameChanged",
          nextName: "Thread 1 updated",
        },
      ),
    ).toEqual({
      renamingThreadId: "thread-1",
      renamingThreadName: "Thread 1 updated",
    });
  });

  it("clears rename state", () => {
    expect(
      threadManagementReducer(
        {
          renamingThreadId: "thread-1",
          renamingThreadName: "Thread 1",
        },
        {
          type: "renameCleared",
        },
      ),
    ).toEqual(initialThreadManagementState);
  });
});
