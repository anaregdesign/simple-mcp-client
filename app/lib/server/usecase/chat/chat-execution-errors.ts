import type { ClientAttachment } from "~/lib/server/usecase/chat/chat-execution-ports";

export class ChatCanceledError extends Error {
  constructor(message = "Chat execution was canceled.") {
    super(message);
    this.name = "ChatCanceledError";
  }
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal || !signal.aborted) {
    return;
  }

  throw new ChatCanceledError();
}

export function isChatCanceledError(error: unknown): boolean {
  if (error instanceof ChatCanceledError) {
    return true;
  }

  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message === "Chat execution was canceled.")
  );
}

export function buildUpstreamErrorMessage(
  error: unknown,
  deploymentName: string,
): string {
  if (!(error instanceof Error)) {
    return "Could not connect to Azure OpenAI.";
  }

  if (isTransientNetworkTerminationError(error)) {
    return "Connection to Azure OpenAI was interrupted before completion. Please retry.";
  }
  if (error.message.includes("Resource not found")) {
    return `${error.message} Check Azure base URL and deployment name (${deploymentName}).`;
  }
  if (error.message.includes("Unavailable model")) {
    return `${error.message} Check the selected deployment name (${deploymentName}).`;
  }
  if (error.message.includes("Model behavior error")) {
    return `${error.message} Verify your model/deployment supports the selected reasoning effort.`;
  }
  if (error.message.includes("repeated Skill operation loop")) {
    return `${error.message} Review active Skills or reduce repeated Skill tool calls, then retry.`;
  }
  if (error.message.includes("excessive Skill operation usage")) {
    return `${error.message} Review active Skills or simplify the workflow, then retry.`;
  }
  if (error.message.includes("too many Skill operation errors")) {
    return `${error.message} Fix failing Skill scripts or reduce unstable steps, then retry.`;
  }
  if (error.message.includes("Max turns (")) {
    return `${error.message} Try reducing active MCP servers or skills, or retry the request.`;
  }

  return error.message;
}

export function isTransientNetworkTerminationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.trim().toLowerCase();
  if (
    normalizedMessage === "terminated" ||
    normalizedMessage.includes("socket closed")
  ) {
    return true;
  }

  const causeCode =
    typeof (error as { cause?: unknown }).cause === "object" &&
    (error as { cause?: { code?: unknown } }).cause !== null
      ? (error as { cause: { code?: unknown } }).cause.code
      : null;
  if (typeof causeCode !== "string") {
    return false;
  }

  const normalizedCauseCode = causeCode.toUpperCase();
  return (
    normalizedCauseCode === "UND_ERR_SOCKET" ||
    normalizedCauseCode === "UND_ERR_ABORTED" ||
    normalizedCauseCode === "ECONNRESET" ||
    normalizedCauseCode === "EPIPE"
  );
}

export function shouldRetryChatExecution(
  error: unknown,
  attempt: number,
  maxAttempts: number,
): boolean {
  if (attempt >= maxAttempts) {
    return false;
  }

  return isTransientNetworkTerminationError(error);
}

export async function awaitWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

export function truncateProgressMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "unknown error";
  }

  const maxLength = 120;
  return trimmed.length <= maxLength
    ? trimmed
    : `${trimmed.slice(0, maxLength - 1)}...`;
}

export function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
