/**
 * Markdown math normalization helpers for assistant messages.
 */

const displayMathEnvironmentNames = [
  "equation",
  "equation*",
  "align",
  "align*",
  "alignat",
  "alignat*",
  "gather",
  "gather*",
  "multline",
  "multline*",
  "CD",
] as const;

export function normalizeChatMarkdownMath(markdown: string): string {
  if (!markdown) {
    return markdown;
  }

  let normalized = "";
  let index = 0;
  let inFencedCodeBlock = false;
  let fencedCodeMarker = "";

  while (index < markdown.length) {
    if (!inFencedCodeBlock && isFenceStart(markdown, index)) {
      const marker = readFenceMarker(markdown, index);
      fencedCodeMarker = marker;
      inFencedCodeBlock = true;
      normalized += marker;
      index += marker.length;
      continue;
    }

    if (inFencedCodeBlock && isFenceEnd(markdown, index, fencedCodeMarker)) {
      normalized += fencedCodeMarker;
      index += fencedCodeMarker.length;
      inFencedCodeBlock = false;
      fencedCodeMarker = "";
      continue;
    }

    if (inFencedCodeBlock) {
      normalized += markdown[index];
      index += 1;
      continue;
    }

    if (markdown[index] === "`") {
      const { segment, nextIndex } = readInlineCodeSpan(markdown, index);
      normalized += segment;
      index = nextIndex;
      continue;
    }

    if (markdown.startsWith("\\[", index)) {
      const closeIndex = markdown.indexOf("\\]", index + 2);
      if (closeIndex !== -1) {
        normalized += toDisplayMathBlock(markdown.slice(index + 2, closeIndex));
        index = closeIndex + 2;
        continue;
      }
    }

    if (markdown.startsWith("\\(", index)) {
      const closeIndex = markdown.indexOf("\\)", index + 2);
      if (closeIndex !== -1) {
        normalized += `$${markdown.slice(index + 2, closeIndex)}$`;
        index = closeIndex + 2;
        continue;
      }
    }

    const environmentMatch = readDisplayMathEnvironment(markdown, index);
    if (environmentMatch) {
      normalized += toDisplayMathBlock(environmentMatch.content);
      index = environmentMatch.nextIndex;
      continue;
    }

    normalized += markdown[index];
    index += 1;
  }

  return normalized;
}

function readInlineCodeSpan(markdown: string, startIndex: number) {
  let tickCount = 0;
  while (markdown[startIndex + tickCount] === "`") {
    tickCount += 1;
  }

  const delimiter = "`".repeat(tickCount);
  const closeIndex = markdown.indexOf(delimiter, startIndex + tickCount);
  if (closeIndex === -1) {
    return {
      segment: markdown.slice(startIndex),
      nextIndex: markdown.length,
    };
  }

  return {
    segment: markdown.slice(startIndex, closeIndex + tickCount),
    nextIndex: closeIndex + tickCount,
  };
}

function isFenceStart(markdown: string, index: number) {
  return isLineStart(markdown, index) &&
    (markdown.startsWith("```", index) || markdown.startsWith("~~~", index));
}

function isFenceEnd(markdown: string, index: number, marker: string) {
  return marker.length > 0 && isLineStart(markdown, index) && markdown.startsWith(marker, index);
}

function isLineStart(markdown: string, index: number) {
  return index === 0 || markdown[index - 1] === "\n";
}

function readFenceMarker(markdown: string, index: number) {
  const markerCharacter = markdown[index];
  let markerLength = 0;
  while (markdown[index + markerLength] === markerCharacter) {
    markerLength += 1;
  }
  return markerCharacter.repeat(markerLength);
}

function readDisplayMathEnvironment(markdown: string, index: number) {
  for (const environmentName of displayMathEnvironmentNames) {
    const startToken = `\\begin{${environmentName}}`;
    if (!markdown.startsWith(startToken, index)) {
      continue;
    }

    const endToken = `\\end{${environmentName}}`;
    const endIndex = markdown.indexOf(endToken, index + startToken.length);
    if (endIndex === -1) {
      return null;
    }

    return {
      content: markdown.slice(index, endIndex + endToken.length),
      nextIndex: endIndex + endToken.length,
    };
  }

  return null;
}

function toDisplayMathBlock(content: string) {
  let normalizedContent = content;
  if (normalizedContent.startsWith("\n")) {
    normalizedContent = normalizedContent.slice(1);
  }
  if (normalizedContent.endsWith("\n")) {
    normalizedContent = normalizedContent.slice(0, -1);
  }
  return `\n$$\n${normalizedContent}\n$$\n`;
}
