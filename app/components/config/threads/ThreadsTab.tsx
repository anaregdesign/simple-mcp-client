/**
 * Client UI component module.
 */
import type { ComponentProps } from "react";
import { InstructionSection } from "~/components/config/threads/InstructionSection";
import {
  ThreadsManageSection,
} from "~/components/config/threads/ThreadsManageSection";
import type { MainViewTab } from "~/lib/client/usecase/workspace/view-types";
import {
  useThreadManagement,
} from "~/lib/client/usecase/workspace/thread-management/use-thread-management";
import type {
  ThreadManagementProps,
} from "~/lib/client/usecase/workspace/thread-management/types";

type ThreadsTabProps = {
  activeMainTab: MainViewTab;
  instructionSectionProps: ComponentProps<typeof InstructionSection>;
} & ThreadManagementProps;

export function ThreadsTab(props: ThreadsTabProps) {
  const {
    activeMainTab,
    activeThreadOptions,
    archivedThreadOptions,
    activeThreadId,
    isLoadingThreads,
    isSwitchingThread,
    isCreatingThread,
    isDeletingThread,
    isClearingThread,
    isRestoringThread,
    threadError,
    onActiveThreadChange,
    onCreateThread,
    onThreadRename,
    onThreadCancel,
    onThreadDelete,
    onThreadClear,
    onThreadRestore,
    instructionSectionProps,
  } = props;
  const threadManagement = useThreadManagement({
    activeThreadOptions,
    isLoadingThreads,
    isSwitchingThread,
    isCreatingThread,
    isDeletingThread,
    isClearingThread,
    isRestoringThread,
    onThreadRename,
  });

  return (
    <section
      className="threads-shell"
      aria-label="Thread settings"
      id="panel-threads"
      role="tabpanel"
      aria-labelledby="tab-threads"
      hidden={activeMainTab !== "threads"}
    >
      <div className="threads-content">
        <InstructionSection {...instructionSectionProps} />
        <ThreadsManageSection
          activeThreadOptions={activeThreadOptions}
          archivedThreadOptions={archivedThreadOptions}
          activeThreadId={activeThreadId}
          isLoadingThreads={isLoadingThreads}
          isSwitchingThread={isSwitchingThread}
          isCreatingThread={isCreatingThread}
          isDeletingThread={isDeletingThread}
          isClearingThread={isClearingThread}
          isRestoringThread={isRestoringThread}
          threadError={threadError}
          onActiveThreadChange={onActiveThreadChange}
          onCreateThread={onCreateThread}
          onThreadRename={onThreadRename}
          onThreadCancel={onThreadCancel}
          onThreadDelete={onThreadDelete}
          onThreadClear={onThreadClear}
          onThreadRestore={onThreadRestore}
          renameInputRef={threadManagement.renameInputRef}
          renamingThreadId={threadManagement.renamingThreadId}
          renamingThreadName={threadManagement.renamingThreadName}
          isThreadOperationBusy={threadManagement.isThreadOperationBusy}
          handleBeginThreadRename={threadManagement.handleBeginThreadRename}
          handleRenameInputChange={threadManagement.handleRenameInputChange}
          handleRenameInputBlur={threadManagement.handleRenameInputBlur}
          handleRenameInputKeyDown={threadManagement.handleRenameInputKeyDown}
        />
      </div>
    </section>
  );
}
