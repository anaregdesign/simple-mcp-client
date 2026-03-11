export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

type UnifiedDiffHunkLine = {
  type: "context" | "added" | "removed";
  content: string;
};

type UnifiedDiffHunk = {
  oldStart: number;
  oldLength: number;
  newStart: number;
  newLength: number;
  lines: UnifiedDiffHunkLine[];
};

export function normalizeInstructionDiffPatchResponse(value: string): string {
  const unwrapped = unwrapCodeFence(value).replace(/\r\n/g, "\n");
  if (!unwrapped.trim()) {
    return "";
  }

  return unwrapped.replace(/^\n+/, "").replace(/\n+$/, "");
}

export function applyInstructionUnifiedDiffPatch(
  originalInstruction: string,
  patch: string,
): ParseResult<string> {
  const parseResult = parseInstructionUnifiedDiffHunks(patch);
  if (!parseResult.ok) {
    return parseResult;
  }

  if (parseResult.value.length === 0) {
    return {
      ok: true,
      value: originalInstruction.replace(/\r\n/g, "\n"),
    };
  }

  const originalLines = splitInstructionLines(originalInstruction);
  const nextLines: string[] = [];
  let oldCursor = 0;

  for (const [hunkIndex, hunk] of parseResult.value.entries()) {
    const resolvedHunkStart = resolveUnifiedDiffHunkStartIndex({
      originalLines,
      oldCursor,
      hunk,
      hunkIndex,
    });
    if (!resolvedHunkStart.ok) {
      return resolvedHunkStart;
    }
    const hunkStartIndex = resolvedHunkStart.value;

    nextLines.push(...originalLines.slice(oldCursor, hunkStartIndex));
    oldCursor = hunkStartIndex;

    for (const [lineIndex, line] of hunk.lines.entries()) {
      if (line.type === "added") {
        nextLines.push(line.content);
        continue;
      }

      const currentOriginalLine = originalLines[oldCursor];
      if (currentOriginalLine !== line.content) {
        return {
          ok: false,
          error:
            `Patch mismatch at hunk #${hunkIndex + 1}, line ${lineIndex + 1}. ` +
            "Please retry enhancement.",
        };
      }

      oldCursor += 1;
      if (line.type === "context") {
        nextLines.push(line.content);
      }
    }
  }

  nextLines.push(...originalLines.slice(oldCursor));
  return {
    ok: true,
    value: nextLines.join("\n"),
  };
}

function parseInstructionUnifiedDiffHunks(patch: string): ParseResult<UnifiedDiffHunk[]> {
  const normalizedPatch = patch.replace(/\r\n/g, "\n");
  if (!normalizedPatch.trim()) {
    return { ok: true, value: [] };
  }

  const lines = normalizedPatch.replace(/^\n+/, "").replace(/\n+$/, "").split("\n");
  const hunks: UnifiedDiffHunk[] = [];
  let cursor = 0;

  while (cursor < lines.length && isUnifiedDiffMetadataLine(lines[cursor])) {
    cursor += 1;
  }

  while (cursor < lines.length) {
    const headerLine = lines[cursor];
    const headerMatch = headerLine.match(
      /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/,
    );
    if (!headerMatch) {
      return {
        ok: false,
        error: "Enhancement patch is not a valid unified diff hunk format.",
      };
    }

    const oldStart = Number(headerMatch[1]);
    const oldLength = headerMatch[2] ? Number(headerMatch[2]) : 1;
    const newStart = Number(headerMatch[3]);
    const newLength = headerMatch[4] ? Number(headerMatch[4]) : 1;
    if (
      !Number.isSafeInteger(oldStart) ||
      !Number.isSafeInteger(oldLength) ||
      !Number.isSafeInteger(newStart) ||
      !Number.isSafeInteger(newLength)
    ) {
      return {
        ok: false,
        error: "Enhancement patch includes invalid hunk line numbers.",
      };
    }

    cursor += 1;
    const hunkLines: UnifiedDiffHunkLine[] = [];
    let oldCount = 0;
    let newCount = 0;

    while (cursor < lines.length) {
      const currentLine = lines[cursor];
      if (/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@(?: .*)?$/.test(currentLine)) {
        break;
      }

      if (currentLine === "\\ No newline at end of file") {
        cursor += 1;
        continue;
      }

      const linePrefix = currentLine[0];
      const lineBody = currentLine.slice(1);
      if (linePrefix === " ") {
        oldCount += 1;
        newCount += 1;
        hunkLines.push({ type: "context", content: lineBody });
      } else if (linePrefix === "-") {
        oldCount += 1;
        hunkLines.push({ type: "removed", content: lineBody });
      } else if (linePrefix === "+") {
        newCount += 1;
        hunkLines.push({ type: "added", content: lineBody });
      } else {
        return {
          ok: false,
          error: "Enhancement patch contains unsupported hunk line markers.",
        };
      }

      cursor += 1;
    }

    if (oldCount !== oldLength || newCount !== newLength) {
      return {
        ok: false,
        error: "Enhancement patch hunk counts do not match header metadata.",
      };
    }

    hunks.push({
      oldStart,
      oldLength,
      newStart,
      newLength,
      lines: hunkLines,
    });
  }

  if (hunks.length === 0) {
    return {
      ok: false,
      error: "Enhancement patch does not include any @@ hunk blocks.",
    };
  }

  return { ok: true, value: hunks };
}

function resolveUnifiedDiffHunkStartIndex(options: {
  originalLines: string[];
  oldCursor: number;
  hunk: UnifiedDiffHunk;
  hunkIndex: number;
}): ParseResult<number> {
  const { originalLines, oldCursor, hunk, hunkIndex } = options;
  const sourceLines = hunk.lines
    .filter((line) => line.type !== "added")
    .map((line) => line.content);

  if (sourceLines.length === 0) {
    return {
      ok: true,
      value: clampInstructionLineIndex(hunk.oldStart - 1, oldCursor, originalLines.length),
    };
  }

  const maxStartIndex = originalLines.length - sourceLines.length;
  if (maxStartIndex < oldCursor) {
    return {
      ok: false,
      error: `Patch hunk #${hunkIndex + 1} starts outside the original instruction.`,
    };
  }

  const preferredStartIndex = Math.max(hunk.oldStart - 1, oldCursor);
  if (
    preferredStartIndex <= maxStartIndex &&
    canMatchUnifiedDiffHunkSourceAtIndex(originalLines, sourceLines, preferredStartIndex)
  ) {
    return { ok: true, value: preferredStartIndex };
  }

  const nearbyStartIndex = findUnifiedDiffHunkStartNearPreferred({
    originalLines,
    sourceLines,
    oldCursor,
    maxStartIndex,
    preferredStartIndex,
    radius: 80,
  });
  if (nearbyStartIndex !== null) {
    return { ok: true, value: nearbyStartIndex };
  }

  for (let startIndex = oldCursor; startIndex <= maxStartIndex; startIndex += 1) {
    if (canMatchUnifiedDiffHunkSourceAtIndex(originalLines, sourceLines, startIndex)) {
      return { ok: true, value: startIndex };
    }
  }

  return {
    ok: false,
    error: `Patch mismatch at hunk #${hunkIndex + 1}, line 1. Please retry enhancement.`,
  };
}

function findUnifiedDiffHunkStartNearPreferred(options: {
  originalLines: string[];
  sourceLines: string[];
  oldCursor: number;
  maxStartIndex: number;
  preferredStartIndex: number;
  radius: number;
}): number | null {
  const {
    originalLines,
    sourceLines,
    oldCursor,
    maxStartIndex,
    preferredStartIndex,
    radius,
  } = options;

  const startIndex = Math.max(oldCursor, preferredStartIndex - radius);
  const endIndex = Math.min(maxStartIndex, preferredStartIndex + radius);
  let matchedStartIndex: number | null = null;
  let matchedDistance = Number.POSITIVE_INFINITY;

  for (let candidateIndex = startIndex; candidateIndex <= endIndex; candidateIndex += 1) {
    if (!canMatchUnifiedDiffHunkSourceAtIndex(originalLines, sourceLines, candidateIndex)) {
      continue;
    }

    const distance = Math.abs(candidateIndex - preferredStartIndex);
    if (distance < matchedDistance) {
      matchedDistance = distance;
      matchedStartIndex = candidateIndex;
    }
  }

  return matchedStartIndex;
}

function canMatchUnifiedDiffHunkSourceAtIndex(
  originalLines: string[],
  sourceLines: string[],
  startIndex: number,
): boolean {
  for (let index = 0; index < sourceLines.length; index += 1) {
    if (originalLines[startIndex + index] !== sourceLines[index]) {
      return false;
    }
  }

  return true;
}

function clampInstructionLineIndex(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function isUnifiedDiffMetadataLine(line: string): boolean {
  if (!line) {
    return true;
  }

  return (
    line.startsWith("diff --git ") ||
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ") ||
    line.startsWith("new file mode ") ||
    line.startsWith("deleted file mode ")
  );
}

function splitInstructionLines(value: string): string[] {
  const normalized = value.replace(/\r\n/g, "\n");
  if (!normalized) {
    return [];
  }

  return normalized.split("\n");
}

function unwrapCodeFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  if (fenced) {
    return fenced[1];
  }

  const fencedWithoutTrailingNewLine = trimmed.match(/^```[^\n]*\n([\s\S]*?)```$/);
  if (fencedWithoutTrailingNewLine) {
    return fencedWithoutTrailingNewLine[1];
  }

  return value;
}
