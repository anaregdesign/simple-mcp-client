/**
 * Client UI component module.
 */
import { FluentUI } from "~/components/shared/fluent";
import { ConfigSection } from "~/components/shared/ConfigSection";
import { LabeledTooltip } from "~/components/shared/LabeledTooltip";
import {
  ContextActionMenu,
  type ContextActionMenuItem,
} from "~/components/shared/ContextActionMenu";
import { CopyableStatusMessageList } from "~/components/CopyableStatusMessageList";
import {
  type ThreadManagementSectionProps,
} from "~/lib/client/usecase/workspace/threads/management/types";
import { isRenamingThread } from "~/lib/client/usecase/workspace/threads/management/selectors";

const { Button, Input, Spinner } = FluentUI;

export function ThreadsManageSection(props: ThreadManagementSectionProps) {
  const {
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
    onThreadCancel,
    onThreadDelete,
    onThreadClear,
    onThreadRestore,
    renameInputRef,
    renamingThreadId,
    renamingThreadName,
    isThreadOperationBusy,
    handleBeginThreadRename,
    handleRenameInputChange,
    handleRenameInputBlur,
    handleRenameInputKeyDown,
  } = props;

  return (
    <ConfigSection
      className="setting-group-threads-manage"
      title="Threads 🧵"
      description="Switch Playground context across conversation, MCP logs, instruction, and connected MCP Servers."
    >
      {isLoadingThreads ? (
        <div className="azure-loading-notice" role="status" aria-live="polite">
          <Spinner size="tiny" />
          Loading threads...
        </div>
      ) : null}
      <div className="threads-action-row">
        <Button
          type="button"
          appearance="secondary"
          size="small"
          className="threads-new-btn"
          onClick={onCreateThread}
          disabled={isThreadOperationBusy}
          title="Create a new thread and switch Playground to it."
        >
          {isCreatingThread ? "Creating..." : "+ New Thread"}
        </Button>
      </div>
      {activeThreadOptions.length === 0 ? (
        <p className="field-hint">No active threads</p>
      ) : (
        <div
          className="threads-active-list"
          role="list"
          aria-label="Playground threads"
        >
          {activeThreadOptions.map((thread) => {
            const isActive = thread.id === activeThreadId;
            const isActiveRename = isRenamingThread(
              {
                renamingThreadId,
                renamingThreadName,
              },
              thread.id,
            );
            const isDeleteDisabled =
              isThreadOperationBusy || thread.isAwaitingResponse;
            const isClearDisabled =
              isThreadOperationBusy ||
              thread.isAwaitingResponse ||
              thread.messageCount === 0;
            const isCancelDisabled =
              isThreadOperationBusy || !thread.isAwaitingResponse;
            const deleteButtonTitle = `Delete thread ${thread.name}`;
            const clearButtonTitle =
              thread.messageCount === 0
                ? `Cannot clear thread ${thread.name} because it has no messages`
                : `Clear messages and MCP logs in thread ${thread.name} while keeping instruction, Skills, and MCP Servers`;
            const cancelButtonTitle = thread.isAwaitingResponse
              ? `Cancel all in-progress processing in thread ${thread.name}`
              : `No in-progress processing to cancel in thread ${thread.name}`;
            const isRenameDisabled =
              isThreadOperationBusy || thread.isAwaitingResponse;
            const activeThreadContextMenuItems: ContextActionMenuItem[] = [
              {
                id: "rename",
                label: "Rename",
                disabled: isRenameDisabled,
                title: `Rename thread ${thread.name}`,
                onSelect: () => {
                  handleBeginThreadRename(thread);
                },
              },
              {
                id: "cancel",
                label: "Cancel",
                disabled: isCancelDisabled,
                title: cancelButtonTitle,
                onSelect: () => {
                  onThreadCancel(thread.id);
                },
              },
              {
                id: "clear",
                label: "Clear",
                disabled: isClearDisabled,
                title: clearButtonTitle,
                onSelect: () => {
                  onThreadClear(thread.id);
                },
              },
              {
                id: "delete",
                label: "Delete",
                disabled: isDeleteDisabled,
                title: deleteButtonTitle,
                intent: "danger",
                onSelect: () => {
                  onThreadDelete(thread.id);
                },
              },
            ];
            return (
              <div
                key={thread.id}
                className="threads-active-item-row"
                role="listitem"
              >
                {isActiveRename ? (
                  <Input
                    ref={renameInputRef}
                    value={renamingThreadName}
                    className="threads-rename-input"
                    aria-label={`Rename thread ${thread.name}`}
                    title={`Rename thread ${thread.name}`}
                    disabled={isThreadOperationBusy}
                    onChange={(_, data) => {
                      handleRenameInputChange(data.value);
                    }}
                    onBlur={() => {
                      handleRenameInputBlur(thread);
                    }}
                    onKeyDown={(event) => {
                      handleRenameInputKeyDown(event, thread);
                    }}
                  />
                ) : (
                  <LabeledTooltip
                    title={thread.name}
                    lines={buildThreadTooltipLines(thread)}
                    className="threads-active-item-tooltip-target"
                  >
                    <ContextActionMenu
                      menuLabel={`Thread actions for ${thread.name}`}
                      items={activeThreadContextMenuItems}
                    >
                      <Button
                        type="button"
                        appearance={isActive ? "secondary" : "subtle"}
                        className={`threads-active-item${isActive ? " is-active" : ""}`}
                        onClick={() => {
                          onActiveThreadChange(thread.id);
                        }}
                        disabled={isThreadOperationBusy}
                        aria-pressed={isActive}
                      >
                        <span className="threads-active-item-content">
                          <span className="threads-active-item-name">
                            {thread.name}
                          </span>
                          {thread.isAwaitingResponse ? (
                            <Spinner
                              size="tiny"
                              className="threads-active-item-pending-spinner"
                              aria-label="Awaiting response"
                            />
                          ) : null}
                        </span>
                      </Button>
                    </ContextActionMenu>
                  </LabeledTooltip>
                )}
              </div>
            );
          })}
        </div>
      )}
      {archivedThreadOptions.length > 0 ? (
        <details className="threads-archived-list">
          <summary className="threads-archived-summary">
            Archives ({archivedThreadOptions.length})
          </summary>
          <div
            className="threads-archived-items"
            role="list"
            aria-label="Archived Playground threads"
          >
            {archivedThreadOptions.map((thread) => {
              const isActive = thread.id === activeThreadId;
              const isRestoreDisabled =
                isThreadOperationBusy || thread.isAwaitingResponse;
              const archivedThreadContextMenuItems: ContextActionMenuItem[] = [
                {
                  id: "restore",
                  label: "Restore",
                  disabled: isRestoreDisabled,
                  title: `Restore thread ${thread.name}`,
                  onSelect: () => {
                    onThreadRestore(thread.id);
                  },
                },
              ];
              return (
                <div
                  key={thread.id}
                  className="threads-archived-item-row"
                  role="listitem"
                >
                  <LabeledTooltip
                    title={thread.name}
                    lines={buildArchivedThreadTooltipLines(thread)}
                    className="threads-active-item-tooltip-target"
                  >
                    <ContextActionMenu
                      menuLabel={`Archive actions for ${thread.name}`}
                      items={archivedThreadContextMenuItems}
                    >
                      <Button
                        type="button"
                        appearance={isActive ? "secondary" : "subtle"}
                        className={`threads-active-item threads-archived-item${isActive ? " is-active" : ""}`}
                        onClick={() => {
                          onActiveThreadChange(thread.id);
                        }}
                        disabled={isThreadOperationBusy}
                        aria-pressed={isActive}
                      >
                        <span className="threads-active-item-content">
                          <span className="threads-active-item-name">
                            {thread.name}
                          </span>
                          {thread.isAwaitingResponse ? (
                            <Spinner
                              size="tiny"
                              className="threads-active-item-pending-spinner"
                              aria-label="Awaiting response"
                            />
                          ) : null}
                        </span>
                      </Button>
                    </ContextActionMenu>
                  </LabeledTooltip>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
      <CopyableStatusMessageList messages={[{ intent: "error", text: threadError }]} />
    </ConfigSection>
  );
}

function formatUpdatedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function buildThreadTooltipLines(
  thread: ThreadManagementSectionProps["activeThreadOptions"][number],
): string[] {
  return [
    `Updated: ${formatUpdatedAt(thread.updatedAt)}`,
    `Messages: ${thread.messageCount}`,
    `Connected MCP Servers: ${thread.mcpServerCount}`,
  ];
}

function buildArchivedThreadTooltipLines(
  thread: ThreadManagementSectionProps["archivedThreadOptions"][number],
): string[] {
  return [
    `Archived: ${formatUpdatedAt(thread.deletedAt ?? thread.updatedAt)}`,
    `Updated: ${formatUpdatedAt(thread.updatedAt)}`,
    `Messages: ${thread.messageCount}`,
    `Connected MCP Servers: ${thread.mcpServerCount}`,
  ];
}
