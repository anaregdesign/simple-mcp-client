export type RunStreamProgressEvent = {
  message: string;
  isMcp?: boolean;
};

export function readProgressEventFromRunStreamEvent(
  event: unknown,
  hasMcpServers: boolean,
  toolNameByCallId: Map<string, string>,
): RunStreamProgressEvent | null {
  if (!isRecord(event) || event.type !== "run_item_stream_event") {
    return null;
  }

  const eventName = event.name;
  if (typeof eventName !== "string") {
    return null;
  }

  const item = event.item;

  if (eventName === "tool_called") {
    const toolName = readToolNameFromRunItem(item);
    const callId = readToolCallIdFromRunItem(item);
    if (callId && toolName) {
      toolNameByCallId.set(callId, toolName);
    }

    const toolLabel = toolName || shortenToolCallId(callId);
    return {
      message: hasMcpServers
        ? `Running MCP command: ${toolLabel}`
        : `Running tool: ${toolLabel}`,
      isMcp: hasMcpServers,
    };
  }

  if (eventName === "tool_output") {
    const callId = readToolCallIdFromRunItem(item);
    const knownToolName = callId ? toolNameByCallId.get(callId) : "";
    if (callId) {
      toolNameByCallId.delete(callId);
    }

    const toolName =
      knownToolName ||
      readToolNameFromRunItem(item) ||
      shortenToolCallId(callId);
    const toolErrorMessage = readToolErrorMessageFromRunItem(item);
    if (toolErrorMessage) {
      return {
        message: hasMcpServers
          ? `MCP command failed: ${toolName} (${truncateProgressMessage(toolErrorMessage)})`
          : `Tool failed: ${toolName} (${truncateProgressMessage(toolErrorMessage)})`,
        isMcp: hasMcpServers,
      };
    }

    return {
      message: hasMcpServers
        ? `MCP command finished: ${toolName}`
        : `Tool finished: ${toolName}`,
      isMcp: hasMcpServers,
    };
  }

  if (eventName === "reasoning_item_created") {
    return {
      message: "Reasoning on your request...",
    };
  }

  if (eventName === "message_output_created") {
    return {
      message: "Generating response...",
    };
  }

  return null;
}

function readToolNameFromRunItem(item: unknown): string {
  if (!isRecord(item)) {
    return "";
  }

  if (typeof item.toolName === "string" && item.toolName.trim()) {
    return item.toolName.trim();
  }

  if (!isRecord(item.rawItem)) {
    return "";
  }

  const rawToolName = item.rawItem.name;
  return typeof rawToolName === "string" ? rawToolName.trim() : "";
}

function readToolCallIdFromRunItem(item: unknown): string {
  if (!isRecord(item) || !isRecord(item.rawItem)) {
    return "";
  }

  const rawCallId = item.rawItem.callId;
  return typeof rawCallId === "string" ? rawCallId.trim() : "";
}

function shortenToolCallId(callId: string): string {
  const trimmed = callId.trim();
  if (!trimmed) {
    return "unknown";
  }

  return trimmed.length <= 12 ? trimmed : `${trimmed.slice(0, 12)}...`;
}

function readToolErrorMessageFromRunItem(item: unknown): string {
  if (!isRecord(item)) {
    return "";
  }

  const output =
    "output" in item
      ? item.output
      : isRecord(item.rawItem)
        ? item.rawItem.output
        : null;
  return readSkillOperationErrorMessageFromToolOutput(output);
}

function readSkillOperationErrorMessageFromToolOutput(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const parsedValue = parseToolOutputPayload(value);
  if (!isRecord(parsedValue)) {
    return "";
  }

  const explicitError = readTrimmedString(parsedValue.error);
  if (parsedValue.ok === false && explicitError) {
    return explicitError;
  }

  if (Object.hasOwn(parsedValue, "exitCode")) {
    const exitCode =
      typeof parsedValue.exitCode === "number" &&
      Number.isFinite(parsedValue.exitCode)
        ? parsedValue.exitCode
        : null;
    if (exitCode !== 0) {
      if (explicitError) {
        return explicitError;
      }

      const stderr = readTrimmedString(parsedValue.stderr);
      if (stderr) {
        return stderr;
      }

      return exitCode === null
        ? "Tool returned an unknown exit status."
        : `Tool exited with code ${exitCode}.`;
    }
  }

  return "";
}

function truncateProgressMessage(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= 120) {
    return trimmed;
  }

  return `${trimmed.slice(0, 117)}...`;
}

function parseToolOutputPayload(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
