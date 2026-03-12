import type { ReactNode, RefObject } from "react";
import { clsx } from "clsx";
import { CopyIconButton } from "~/components/shared/CopyIconButton";
import { PlaygroundTurnMessageSkillActivationBubbles } from "~/components/playground/PlaygroundTurnMessageSkillActivationBubbles";
import type {
  ThreadMessageView,
  ThreadOperationLogEntryView,
} from "~/lib/client/usecase/workspace/playground-panel/view-types";
import styles from "~/components/playground/PlaygroundConversation.module.css";

type PlaygroundConversationProps<
  TMessage extends ThreadMessageView,
  TThreadOperationLogEntry extends ThreadOperationLogEntryView,
> = {
  messages: TMessage[];
  threadOperationLogsByTurnId: Map<string, TThreadOperationLogEntry[]>;
  renderMessageContent: (
    message: TMessage,
    onCopyText: (content: string) => void,
  ) => ReactNode;
  renderTurnOperationLog: (
    entries: TThreadOperationLogEntry[],
    isLive: boolean,
    onCopy: (text: string) => void,
  ) => ReactNode;
  onCopyMessage: (content: string) => void;
  onCopyOperationLog: (content: string) => void;
  isSending: boolean;
  sendProgressMessages: string[];
  activeTurnOperationLogs: TThreadOperationLogEntry[];
  errorTurnOperationLogs: TThreadOperationLogEntry[];
  endOfMessagesRef: RefObject<HTMLDivElement | null>;
};

export function PlaygroundConversation<
  TMessage extends ThreadMessageView,
  TThreadOperationLogEntry extends ThreadOperationLogEntryView,
>({
  messages,
  threadOperationLogsByTurnId,
  renderMessageContent,
  renderTurnOperationLog,
  onCopyMessage,
  onCopyOperationLog,
  isSending,
  sendProgressMessages,
  activeTurnOperationLogs,
  errorTurnOperationLogs,
  endOfMessagesRef,
}: PlaygroundConversationProps<TMessage, TThreadOperationLogEntry>) {
  return (
    <div className={styles.log} aria-live="polite">
      {messages.map((message) => {
        const turnOperationLogs =
          threadOperationLogsByTurnId.get(message.turnId) ?? [];
        const shouldRenderTurnOperationLog =
          message.role === "assistant" && turnOperationLogs.length > 0;

        return (
          <div
            key={message.id}
            className={clsx(
              styles.turnEntry,
              message.role === "user" ? styles.turnEntryUser : styles.turnEntryAssistant,
            )}
          >
            <article
              className={clsx(
                styles.messageRow,
                message.role === "user" ? styles.userRow : styles.assistantRow,
              )}
            >
              <div className={styles.messageContent}>
                {renderMessageContent(message, onCopyMessage)}
              </div>
              <CopyIconButton
                className={styles.messageCopyButton}
                ariaLabel="Copy message"
                title="Copy this message."
                onClick={() => {
                  onCopyMessage(message.content);
                }}
              />
            </article>
            <PlaygroundTurnMessageSkillActivationBubbles message={message} />
            {shouldRenderTurnOperationLog ? (
              <article className={styles.logRow}>
                {renderTurnOperationLog(turnOperationLogs, false, (text) => {
                  onCopyOperationLog(text);
                })}
              </article>
            ) : null}
          </div>
        );
      })}

      {isSending ? (
        <article className={clsx(styles.messageRow, styles.assistantRow, styles.progressRow)}>
          <div className={styles.typingProgress} role="status" aria-live="polite">
            {sendProgressMessages.length > 0 ? (
              <ul className={styles.typingProgressList}>
                {sendProgressMessages.map((status, index) => (
                  <li
                    key={`${index}-${status}`}
                    className={clsx(
                      styles.typingProgressItem,
                      index === sendProgressMessages.length - 1 &&
                        styles.typingProgressItemActive,
                    )}
                  >
                    {status}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.typing}>Thinking...</p>
            )}
          </div>
        </article>
      ) : null}
      {isSending && activeTurnOperationLogs.length > 0 ? (
        <article className={styles.logRow}>
          {renderTurnOperationLog(activeTurnOperationLogs, true, (text) => {
            onCopyOperationLog(text);
          })}
        </article>
      ) : null}
      {!isSending && errorTurnOperationLogs.length > 0 ? (
        <article className={styles.logRow}>
          {renderTurnOperationLog(errorTurnOperationLogs, false, (text) => {
            onCopyOperationLog(text);
          })}
        </article>
      ) : null}
      <div ref={endOfMessagesRef} />
    </div>
  );
}
