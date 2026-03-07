/**
 * Home UI component module.
 */
import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import rehypeKatex from "rehype-katex";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { CopyableBlock } from "~/components/home/shared/CopyableBlock";
import { CopyIconButton } from "~/components/home/shared/CopyIconButton";
import { formatChatAttachmentSize } from "~/lib/home/chat/attachments";
import { buildThreadOperationLogCopyPayload, readOperationLogType } from "~/lib/home/chat/history";
import { normalizeChatMarkdownMath } from "~/lib/home/chat/math-markdown";
import {
  readMarkdownBlockCopyText,
  type MarkdownBlockNode,
} from "~/lib/home/chat/markdown-block-copy";
import type { ThreadMessage } from "~/lib/home/chat/messages";
import type { JsonToken } from "~/lib/home/chat/json-highlighting";
import {
  formatJsonForDisplay,
  isJsonCodeClassName,
  parseJsonMessageTokens,
  tokenizeJson,
} from "~/lib/home/chat/json-highlighting";
import type { ThreadOperationLogEntry } from "~/lib/home/chat/stream";

type JsonHighlightStyle = "default" | "compact";
type CopyableMarkdownBlockKind =
  | "code block"
  | "blockquote"
  | "table"
  | "unordered list"
  | "ordered list";

export function renderTurnOperationLog(
  entries: ThreadOperationLogEntry[],
  isLive: boolean,
  onCopyText: (text: string) => void,
) {
  return (
    <details className="mcp-turn-log">
      <summary>
        <span>🧩 MCP / Skill Operation Log ({entries.length})</span>
        <CopyIconButton
          className="mcp-log-copy-btn"
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
        <p className="mcp-turn-log-empty">
          {isLive
            ? "Waiting for MCP / Skill operations..."
            : "No MCP / Skill operations in this turn."}
        </p>
      ) : (
        <div className="mcp-history-list">
          {entries.map((entry) => {
            const operationType = readOperationLogType(entry);
            const isSystemSkillOperation =
              operationType === "skill" && entry.serverName === "skill-runtime";
            const operationLabel =
              operationType === "mcp" ? "MCP" : isSystemSkillOperation ? "SYSTEM" : "SKILL";
            const operationBadgeType =
              operationType === "mcp" ? "mcp" : isSystemSkillOperation ? "system" : "skill";
            return (
              <details key={entry.id} className="mcp-history-item">
                <summary>
                  <span className="mcp-history-seq">#{entry.sequence}</span>
                  <span className={`mcp-history-type-badge ${operationBadgeType}`}>
                    {operationLabel}
                  </span>
                  <span className="mcp-history-method">{entry.method}</span>
                  <span className="mcp-history-server">{entry.serverName}</span>
                  <span className={`mcp-history-state ${entry.isError ? "error" : "ok"}`}>
                    {entry.isError ? "error" : "ok"}
                  </span>
                  <CopyIconButton
                    className="mcp-history-copy-btn"
                    ariaLabel="Copy operation entry"
                    title="Copy this operation entry."
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onCopyText(formatJsonForDisplay(buildThreadOperationLogCopyPayload(entry)));
                    }}
                  />
                </summary>
                <div className="mcp-history-body">
                  <p className="mcp-history-time">
                    {entry.startedAt}
                    {" -> "}
                    {entry.completedAt}
                  </p>
                  <p className="mcp-history-label-row">
                    <span className="mcp-history-label">request</span>
                    <CopyIconButton
                      className="mcp-part-copy-btn"
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
                  <p className="mcp-history-label-row">
                    <span className="mcp-history-label">response</span>
                    <CopyIconButton
                      className="mcp-part-copy-btn"
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
      <div className="user-message-body">
        <p>{message.content}</p>
        {message.attachments.length > 0 ? (
          <ul className="user-message-attachments" aria-label="Attached files">
            {message.attachments.map((attachment, index) => (
              <li key={`${message.id}-attachment-${index}`}>
                <span className="user-message-attachment-name">{attachment.name}</span>
                <span className="user-message-attachment-size">
                  {formatChatAttachmentSize(attachment.sizeBytes)}
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
      className={className}
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
    <div className="markdown-message">
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
                    className={token.type === "plain" ? undefined : `json-token ${token.type}`}
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
  const className = style === "compact" ? "json-message mcp-history-json" : "json-message";
  return (
    <pre className={className} aria-label={ariaLabel}>
      {tokens.map((token, index) => (
        <span
          key={`${token.type}-${index}`}
          className={token.type === "plain" ? undefined : `json-token ${token.type}`}
        >
          {token.value}
        </span>
      ))}
    </pre>
  );
}
