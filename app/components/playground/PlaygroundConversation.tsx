import type { ReactNode, RefObject } from "react";
import { CopyIconButton } from "~/components/shared/CopyIconButton";
import { PlaygroundTurnMessageSkillActivationBubbles } from "~/components/playground/PlaygroundTurnMessageSkillActivationBubbles";
import type {
  ThreadMessageView,
  ThreadOperationLogEntryView,
} from "~/lib/client/usecase/workspace/view-types";

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
    <div className="chat-log" aria-live="polite">
      {messages.map((message) => {
        const turnOperationLogs =
          threadOperationLogsByTurnId.get(message.turnId) ?? [];
        const shouldRenderTurnOperationLog =
          message.role === "assistant" && turnOperationLogs.length > 0;

        return (
          <div key={message.id} className={`turn-entry ${message.role}`}>
            <article
              className={`message-row ${message.role === "user" ? "user" : "assistant"}`}
            >
              <div className="message-content">
                {renderMessageContent(message, onCopyMessage)}
              </div>
              <CopyIconButton
                className="message-copy-btn"
                ariaLabel="Copy message"
                title="Copy this message."
                onClick={() => {
                  onCopyMessage(message.content);
                }}
              />
            </article>
            <PlaygroundTurnMessageSkillActivationBubbles message={message} />
            {shouldRenderTurnOperationLog ? (
              <article className="mcp-turn-log-row">
                {renderTurnOperationLog(turnOperationLogs, false, (text) => {
                  onCopyOperationLog(text);
                })}
              </article>
            ) : null}
          </div>
        );
      })}

      {isSending ? (
        <article className="message-row assistant progress-row">
          <div className="typing-progress" role="status" aria-live="polite">
            {sendProgressMessages.length > 0 ? (
              <ul className="typing-progress-list">
                {sendProgressMessages.map((status, index) => (
                  <li
                    key={`${index}-${status}`}
                    className={
                      index === sendProgressMessages.length - 1 ? "active" : ""
                    }
                  >
                    {status}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="typing">Thinking...</p>
            )}
          </div>
        </article>
      ) : null}
      {isSending && activeTurnOperationLogs.length > 0 ? (
        <article className="mcp-turn-log-row">
          {renderTurnOperationLog(activeTurnOperationLogs, true, (text) => {
            onCopyOperationLog(text);
          })}
        </article>
      ) : null}
      {!isSending && errorTurnOperationLogs.length > 0 ? (
        <article className="mcp-turn-log-row">
          {renderTurnOperationLog(errorTurnOperationLogs, false, (text) => {
            onCopyOperationLog(text);
          })}
        </article>
      ) : null}
      <div ref={endOfMessagesRef} />
    </div>
  );
}
