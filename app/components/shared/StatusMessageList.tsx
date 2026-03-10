/**
 * Client UI component module.
 */
import type { ComponentProps } from "react";
import { CopyIconButton } from "~/components/shared/CopyIconButton";
import { FluentUI } from "~/components/shared/fluent";

const { MessageBar, MessageBarBody, MessageBarTitle } = FluentUI;

type StatusMessageIntent = NonNullable<ComponentProps<typeof MessageBar>["intent"]>;

export type StatusMessage = {
  intent: StatusMessageIntent;
  text: string | null | undefined;
  title?: string;
};

type StatusMessageListProps = {
  className?: string;
  messages: StatusMessage[];
  onCopyText?: (text: string) => void;
};

export function StatusMessageList(props: StatusMessageListProps) {
  const { className, messages, onCopyText } = props;

  const handleCopyMessage = (message: StatusMessage) => {
    const parts = [message.title, message.text]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));
    const text = parts.join("\n");
    if (!text) {
      return;
    }

    onCopyText?.(text);
  };

  return (
    <div className={className}>
      {messages.map((message, index) => {
        if (!message.text) {
          return null;
        }

        return (
          <MessageBar key={`${message.intent}-${index}`} intent={message.intent} className="setting-message-bar">
            <MessageBarBody className="status-message-body">
              <div className="status-message-main">
                {message.title ? <MessageBarTitle>{message.title}</MessageBarTitle> : null}
                <span className="status-message-text">{message.text}</span>
              </div>
              {onCopyText ? (
                <CopyIconButton
                  ariaLabel={message.title ? `${message.title} message copy` : "Message copy"}
                  title={message.title ? `${message.title} message copy` : "Copy message"}
                  className="status-message-copy-btn"
                  onClick={() => {
                    handleCopyMessage(message);
                  }}
                />
              ) : null}
            </MessageBarBody>
          </MessageBar>
        );
      })}
    </div>
  );
}
