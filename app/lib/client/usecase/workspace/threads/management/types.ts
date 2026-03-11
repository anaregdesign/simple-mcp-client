import type { KeyboardEvent, RefObject } from "react";
import type { ThreadListOption } from "../thread-runtime";

export type ThreadManagementProps = {
  activeThreadOptions: ThreadListOption[];
  archivedThreadOptions: ThreadListOption[];
  activeThreadId: string;
  isLoadingThreads: boolean;
  isSwitchingThread: boolean;
  isCreatingThread: boolean;
  isDeletingThread: boolean;
  isClearingThread: boolean;
  isRestoringThread: boolean;
  threadError: string | null;
  onActiveThreadChange: (threadId: string) => void;
  onCreateThread: () => void;
  onThreadRename: (threadId: string, nextName: string) => void;
  onThreadCancel: (threadId: string) => void;
  onThreadDelete: (threadId: string) => void;
  onThreadClear: (threadId: string) => void;
  onThreadRestore: (threadId: string) => void;
};

export type ThreadManagementHookOptions = Pick<
  ThreadManagementProps,
  | "activeThreadOptions"
  | "isLoadingThreads"
  | "isSwitchingThread"
  | "isCreatingThread"
  | "isDeletingThread"
  | "isClearingThread"
  | "isRestoringThread"
  | "onThreadRename"
>;

export type ThreadManagementViewModel = {
  renameInputRef: RefObject<HTMLInputElement | null>;
  renamingThreadId: string;
  renamingThreadName: string;
  isThreadOperationBusy: boolean;
  handleBeginThreadRename: (thread: ThreadListOption) => void;
  handleRenameInputChange: (value: string) => void;
  handleRenameInputBlur: (thread: ThreadListOption) => void;
  handleRenameInputKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    thread: ThreadListOption,
  ) => void;
};

export type ThreadManagementSectionProps = ThreadManagementProps &
  ThreadManagementViewModel;
