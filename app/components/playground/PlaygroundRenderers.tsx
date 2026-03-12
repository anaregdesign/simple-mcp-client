/**
 * Client UI component module.
 */
import { clsx } from "clsx";
import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import rehypeKatex from "rehype-katex";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { formatPlaygroundAttachmentSize } from "~/components/playground/rendering/attachment-size";
import { buildThreadOperationLogCopyPayload } from "~/components/playground/rendering/operation-log-copy";
import {
  formatJsonForDisplay,
  isJsonCodeClassName,
  parseJsonMessageTokens,
  tokenizeJson,
  type JsonToken,
} from "~/components/playground/rendering/json-highlighting";
import { normalizeChatMarkdownMath } from "~/components/playground/rendering/math-markdown";
import {
  readMarkdownBlockCopyText,
  type MarkdownBlockNode,
} from "~/components/playground/rendering/markdown-block-copy";
import { CopyableBlock } from "~/components/shared/CopyableBlock";
import { CopyIconButton } from "~/components/shared/CopyIconButton";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import {
  readOperationLogType,
  type ThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";
import styles from "~/components/playground/PlaygroundRenderers.module.css";

type JsonHighlightStyle = "default" | "compact";
type CopyableMarkdownBlockKind =
  | "code block"
  | "blockquote"
  | "table"
  | "unordered list"
  | "ordered list";

const jsonTokenClassByType: Record<Exclude<JsonToken["type"], "plain">, string> = {
  key: styles.jsonTokenKey,
  string: styles.jsonTokenString,
  number: styles.jsonTokenNumber,
  boolean: styles.jsonTokenBoolean,
  null: styles.jsonTokenNull,
  punctuation: styles.jsonTokenPunctuation,
};

export function renderTurnOperationLog(
  entries: ThreadOperationLogEntry[],
  isLive: boolean,
  onCopyText: (text: string) => void,
) {
  return (
    <details className={styles.turnLog}>
      <summary className={styles.turnLogSummary}>
        <span>🧩 MCP / Skill Operation Log ({entries.length})</span>
        <CopyIconButton
          className={styles.logCopyButton}
          ariaLabel="Copy MCP and Skill operation log"
          title="Copy all MCP and Skill operation logs in this turn."
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onCopyText(
              formatJsonForDisplay(
                entries.map((entry) => buildThreadOperationLogCopyPayload(entry)),
              ),
            );
          }}
        />
      </summary>
      {entries.length === 0 ? (
        <p className={styles.turnLogEmpty}>
          {isLive
            ? "Waiting for MCP / Skill operations..."
            : "No MCP / Skill operations in this turn."}
        </p>
      ) : (
        <div className={styles.historyList}>
          {entries.map((entry) => {
            const operationType = readOperationLogType(entry);
            const isSystemSkillOperation =
              operationType === "skill" && entry.serverName === "skill-runtime";
            const operationLabel =
              operationType === "mcp" ? "MCP" : isSystemSkillOperation ? "SYSTEM" : "SKILL";
            const operationBadgeClassName =
              operationType === "mcp"
                ? styles.historyTypeMcp
                : isSystemSkillOperation
                  ? styles.historyTypeSystem
                  : styles.historyTypeSkill;
            return (
              <details key={entry.id} className={styles.historyItem}>
                <summary className={styles.historySummary}>
                  <span className={styles.historySequence}>#{entry.sequence}</span>
                  <span className={clsx(styles.historyTypeBadge, operationBadgeClassName)}>
                    {operationLabel}
                  </span>
                  <span className={styles.historyMethod}>{entry.method}</span>
                  <span className={styles.historyServer}>{entry.serverName}</span>
                  <span
                    className={clsx(
                      styles.historyState,
                      entry.isError ? styles.historyStateError : styles.historyStateOk,
                    )}
                  >
                    {entry.isError ? "error" : "ok"}
                  </span>
                  <CopyIconButton
                    className={styles.historyCopyButton}
                    ariaLabel="Copy operation entry"
                    title="Copy this operation entry."
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onCopyText(formatJsonForDisplay(buildThreadOperationLogCopyPayload(entry)));
                    }}
                  />
                </summary>
                <div className={styles.historyBody}>
                  <p className={styles.historyTime}>
                    {entry.startedAt}
                    {" -> "}
                    {entry.completedAt}
                  </p>
                  <p className={styles.historyLabelRow}>
                    <span className={styles.historyLabel}>request</span>
                    <CopyIconButton
                      className={styles.partCopyButton}
                      ariaLabel="Copy operation request payload"
                      title="Copy operation request payload."
                      onClick={() => {
                        onCopyText(
                          formatJsonForDisplay({
                            request: entry.request ?? null,
                          }),
                        );
                      }}
                    />
                  </p>
                  {renderHighlightedJson(entry.request, "Operation request JSON", "compact")}
                  <p className={styles.historyLabelRow}>
                    <span className={styles.historyLabel}>response</span>
                    <CopyIconButton
                      className={styles.partCopyButton}
                      ariaLabel="Copy operation response payload"
                      title="Copy operation response payload."
                      onClick={() => {
                        onCopyText(
                          formatJsonForDisplay({
                            response: entry.response ?? null,
                          }),
                        );
                      }}
                    />
                  </p>
                  {renderHighlightedJson(entry.response, "Operation response JSON", "compact")}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </details>
  );
}

export function renderMessageContent(
  message: ThreadMessage,
  onCopyText: (content: string) => void,
) {
  if (message.role !== "assistant") {
    return (
      <div className={styles.userMessageBody}>
        <p>{message.content}</p>
        {message.attachments.length > 0 ? (
          <ul className={styles.userMessageAttachments} aria-label="Attached files">
            {message.attachments.map((attachment, index) => (
              <li key={`${message.id}-attachment-${index}`}>
                <span className={styles.userMessageAttachmentName}>{attachment.name}</span>
                <span className={styles.userMessageAttachmentSize}>
                  {formatPlaygroundAttachmentSize(attachment.sizeBytes)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const jsonTokens = parseJsonMessageTokens(message.content);
  if (!jsonTokens) {
    return <MarkdownMessageContent content={message.content} onCopyText={onCopyText} />;
  }

  return renderJsonTokens(jsonTokens, "JSON response", "default");
}

function renderCopyableMarkdownBlock(params: {
  kind: CopyableMarkdownBlockKind;
  node: MarkdownBlockNode | undefined;
  onCopyText: (content: string) => void;
  content: ReactNode;
  className?: string;
}) {
  const { kind, node, onCopyText, content, className } = params;

  return (
    <CopyableBlock
      className={clsx(styles.copyableBlockWrapper, className)}
      ariaLabel={`Copy ${kind}`}
      title={`Copy ${kind}.`}
      copyText={readMarkdownBlockCopyText(node)}
      onCopyText={onCopyText}
    >
      {content}
    </CopyableBlock>
  );
}

function MarkdownMessageContent(props: {
  content: string;
  onCopyText: (content: string) => void;
}) {
  const { content, onCopyText } = props;
  const normalizedContent = normalizeChatMarkdownMath(content);

  return (
    <div className={styles.markdownMessage}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          pre: ({ node, children, ...props }) =>
            renderCopyableMarkdownBlock({
              kind: "code block",
              node: node as MarkdownBlockNode | undefined,
              onCopyText,
              content: <pre {...props}>{children}</pre>,
            }),
          blockquote: ({ node, children, ...props }) =>
            renderCopyableMarkdownBlock({
              kind: "blockquote",
              node: node as MarkdownBlockNode | undefined,
              onCopyText,
              content: <blockquote {...props}>{children}</blockquote>,
            }),
          table: ({ node, children, ...props }) =>
            renderCopyableMarkdownBlock({
              kind: "table",
              node: node as MarkdownBlockNode | undefined,
              onCopyText,
              content: <table {...props}>{children}</table>,
            }),
          ul: ({ node, children, ...props }) =>
            renderCopyableMarkdownBlock({
              kind: "unordered list",
              node: node as MarkdownBlockNode | undefined,
              onCopyText,
              content: <ul {...props}>{children}</ul>,
            }),
          ol: ({ node, children, ...props }) =>
            renderCopyableMarkdownBlock({
              kind: "ordered list",
              node: node as MarkdownBlockNode | undefined,
              onCopyText,
              content: <ol {...props}>{children}</ol>,
            }),
          code: ({ className, children, ...props }) => {
            const isJsonCode = isJsonCodeClassName(className);
            if (!isJsonCode) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }

            const rawText = String(children).replace(/\n$/, "");
            const tokens = parseJsonMessageTokens(rawText) ?? tokenizeJson(rawText);
            return (
              <code className={className} {...props}>
                {tokens.map((token, index) => (
                  <span
                    key={`${token.type}-${index}`}
                    className={readJsonTokenClassName(token.type)}
                  >
                    {token.value}
                  </span>
                ))}
              </code>
            );
          },
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}

function renderHighlightedJson(
  value: unknown,
  ariaLabel: string,
  style: JsonHighlightStyle,
) {
  const formatted = formatJsonForDisplay(value);
  const tokens = tokenizeJson(formatted);
  return renderJsonTokens(tokens, ariaLabel, style);
}

function renderJsonTokens(
  tokens: JsonToken[],
  ariaLabel: string,
  style: JsonHighlightStyle,
) {
  return (
    <pre
      className={clsx(
        styles.jsonMessage,
        style === "compact" ? styles.historyJson : styles.messageJson,
      )}
      aria-label={ariaLabel}
    >
      {tokens.map((token, index) => (
        <span
          key={`${token.type}-${index}`}
          className={readJsonTokenClassName(token.type)}
        >
          {token.value}
        </span>
      ))}
    </pre>
  );
}

function readJsonTokenClassName(type: JsonToken["type"]): string | undefined {
  if (type === "plain") {
    return undefined;
  }

  return jsonTokenClassByType[type];
}
