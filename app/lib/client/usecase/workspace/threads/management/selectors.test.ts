/**
 * Tests for thread-management selectors and handler helpers.
 */
import { describe, expect, it } from "vitest";
import { THREAD_NAME_MAX_LENGTH } from "~/lib/domain/value-objects/thread-name";
import {
  normalizeThreadRenameInput,
  resolveThreadRenameKeyAction,
} from "~/lib/client/usecase/workspace/threads/management/handlers";
import {
  canSubmitThreadRename,
  doesActiveRenameTargetExist,
  hasActiveThreadRename,
  isRenamingThread,
  selectIsThreadOperationBusy,
} from "~/lib/client/usecase/workspace/threads/management/selectors";
import type { ThreadManagementState } from "~/lib/client/usecase/workspace/threads/management/state";

const renamingState: ThreadManagementState = {
  renamingThreadId: "thread-1",
  renamingThreadName: "Thread 1",
};

describe("selectIsThreadOperationBusy", () => {
  it("returns true when any thread action is in progress", () => {
    expect(
      selectIsThreadOperationBusy({
        isLoadingThreads: false,
        isSwitchingThread: false,
        isCreatingThread: false,
        isDeletingThread: false,
        isClearingThread: false,
        isRestoringThread: true,
      }),
    ).toBe(true);
  });

  it("returns false when all thread actions are idle", () => {
    expect(
      selectIsThreadOperationBusy({
        isLoadingThreads: false,
        isSwitchingThread: false,
        isCreatingThread: false,
        isDeletingThread: false,
        isClearingThread: false,
        isRestoringThread: false,
      }),
    ).toBe(false);
  });
});

describe("thread-management selectors", () => {
  it("tracks active rename state and matching thread ids", () => {
    expect(hasActiveThreadRename(renamingState)).toBe(true);
    expect(isRenamingThread(renamingState, "thread-1")).toBe(true);
    expect(isRenamingThread(renamingState, "thread-2")).toBe(false);
    expect(canSubmitThreadRename(renamingState, "thread-1")).toBe(true);
    expect(canSubmitThreadRename(renamingState, "thread-2")).toBe(false);
  });

  it("detects when the renamed thread disappears from the list", () => {
    expect(
      doesActiveRenameTargetExist(renamingState, [
        {
          id: "thread-1",
          name: "Thread 1",
          updatedAt: "2026-03-09T00:00:00.000Z",
          deletedAt: null,
          messageCount: 1,
          mcpServerCount: 0,
          isAwaitingResponse: false,
        },
      ]),
    ).toBe(true);

    expect(doesActiveRenameTargetExist(renamingState, [])).toBe(false);
  });
});

describe("thread-management handlers", () => {
  it("normalizes rename input length", () => {
    expect(normalizeThreadRenameInput("a".repeat(300)).length).toBe(
      THREAD_NAME_MAX_LENGTH,
    );
  });

  it("maps rename keyboard events to actions", () => {
    expect(resolveThreadRenameKeyAction("Enter")).toBe("submit");
    expect(resolveThreadRenameKeyAction("Escape")).toBe("cancel");
    expect(resolveThreadRenameKeyAction("Tab")).toBeNull();
  });
});
