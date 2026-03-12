/**
 * Client UI component module.
 */
import { clsx } from "clsx";
import type { ComponentProps } from "react";
import { CopyIconButton } from "~/components/shared/CopyIconButton";
import { FluentUI } from "~/components/shared/fluent";
import styles from "~/components/shared/StatusMessageList.module.css";

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
    <div className={clsx(styles.list, className)}>
      {messages.map((message, index) => {
        if (!message.text) {
          return null;
        }

        return (
          <MessageBar key={`${message.intent}-${index}`} intent={message.intent} className={styles.bar}>
            <MessageBarBody className={styles.body}>
              <div className={styles.main}>
                {message.title ? <MessageBarTitle>{message.title}</MessageBarTitle> : null}
                <span className={styles.text}>{message.text}</span>
              </div>
              {onCopyText ? (
                <CopyIconButton
                  ariaLabel={message.title ? `${message.title} message copy` : "Message copy"}
                  title={message.title ? `${message.title} message copy` : "Copy message"}
                  className={styles.copyButton}
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
