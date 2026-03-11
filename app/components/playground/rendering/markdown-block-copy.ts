/**
 * Client runtime support module.
 */
export type MarkdownBlockNode = {
  type?: string;
  tagName?: string;
  value?: string;
  children?: MarkdownBlockNode[] | undefined;
};

export function readMarkdownBlockCopyText(node: MarkdownBlockNode | undefined): string {
  return normalizeMarkdownBlockCopyText(readMarkdownNodeText(node));
}

function readMarkdownNodeText(node: MarkdownBlockNode | undefined): string {
  if (!node) {
    return "";
  }

  if (node.type === "text") {
    return node.value ?? "";
  }

  const tagName = node.tagName?.toLowerCase();
  if (!tagName) {
    return readMarkdownChildrenText(node.children);
  }

  switch (tagName) {
    case "br":
      return "\n";
    case "pre":
    case "code":
    case "p":
      return readMarkdownChildrenText(node.children);
    case "blockquote":
    case "div":
    case "section":
    case "thead":
    case "tbody":
    case "tfoot":
    case "li":
    case "table":
      return joinNonEmpty(node.children, "\n");
    case "ul":
      return readMarkdownList(node.children, false);
    case "ol":
      return readMarkdownList(node.children, true);
    case "tr":
      return joinNonEmpty(node.children, "\t");
    case "th":
    case "td":
    case "a":
    case "strong":
    case "em":
    case "del":
    case "span":
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return readMarkdownChildrenText(node.children);
    default:
      return readMarkdownChildrenText(node.children);
  }
}

function readMarkdownChildrenText(children: MarkdownBlockNode[] | undefined): string {
  if (!children || children.length === 0) {
    return "";
  }

  return children.map((child) => readMarkdownNodeText(child)).join("");
}

function joinNonEmpty(children: MarkdownBlockNode[] | undefined, separator: string): string {
  if (!children || children.length === 0) {
    return "";
  }

  return children
    .map((child) => readMarkdownNodeText(child))
    .filter((value) => value.length > 0)
    .join(separator);
}

function readMarkdownList(
  children: MarkdownBlockNode[] | undefined,
  isOrdered: boolean,
): string {
  if (!children || children.length === 0) {
    return "";
  }

  return children
    .filter((child) => child.tagName?.toLowerCase() === "li")
    .map((child, index) => {
      const prefix = isOrdered ? `${index + 1}. ` : "- ";
      const text = readMarkdownNodeText(child);
      return prefixMultilineText(text, prefix);
    })
    .join("\n");
}

function prefixMultilineText(value: string, prefix: string): string {
  const lines = value.split("\n");
  if (lines.length === 0) {
    return prefix.trimEnd();
  }

  return lines
    .map((line, index) =>
      index === 0 ? `${prefix}${line}` : `${" ".repeat(prefix.length)}${line}`,
    )
    .join("\n");
}

function normalizeMarkdownBlockCopyText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/^\n+|\n+$/g, "");
}
