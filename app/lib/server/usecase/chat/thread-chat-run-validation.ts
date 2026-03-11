import type { Thread } from "~/lib/domain/entities/thread";
import type { ThreadRepository } from "~/lib/domain/repositories/thread-repository";
import type {
  ThreadChatRunError,
  ThreadChatRunRequest,
} from "~/lib/server/usecase/chat/thread-chat-run";

export async function loadThreadSnapshot(
  request: ThreadChatRunRequest,
  repository: ThreadRepository,
  createError: typeof createThreadChatRunError,
): Promise<Thread> {
  const thread = await repository.findByIdForUser(
    request.userId,
    request.threadId,
  );
  if (!thread) {
    throw createError(404, "thread_not_found", "Thread not found.");
  }
  if (thread.isArchived()) {
    throw createError(
      409,
      "thread_archived",
      "Archived thread is read-only.",
    );
  }

  return thread;
}

export function readThreadAzureConfig(
  thread: Thread,
  createError: typeof createThreadChatRunError,
) {
  const config = thread.chatAzureConfig;
  if (!config) {
    throw createError(
      422,
      "chat_azure_config_required",
      "Thread chatAzureConfig is required.",
    );
  }

  return config;
}

export function validateThreadExecutionConfiguration(
  thread: Thread,
  createError: typeof createThreadChatRunError,
): void {
  if (thread.webSearchEnabled && thread.reasoningEffort === "minimal") {
    throw createError(
      422,
      "web_search_reasoning_effort_not_supported",
      "Selected Reasoning Effort cannot be used with Web Search.",
    );
  }

  if (
    thread.reasoningEffort === "minimal" &&
    thread.chatAzureConfig?.deploymentName
      .trim()
      .toLowerCase()
      .startsWith("gpt-5.4")
  ) {
    throw createError(
      422,
      "reasoning_effort_not_supported",
      "Selected Reasoning Effort is not supported by the thread deployment.",
    );
  }
}

export function readCurrentUserMessage(
  thread: Thread,
  turnId: string,
  createError: typeof createThreadChatRunError,
) {
  const currentUserMessage = [...thread.messages]
    .reverse()
    .find((message) => message.turnId === turnId && message.role === "user");
  if (!currentUserMessage) {
    throw createError(
      422,
      "turn_not_found",
      "`turnId` must reference a persisted user message.",
    );
  }

  return currentUserMessage;
}

function createThreadChatRunError(
  status: 404 | 409 | 422,
  code:
    | "thread_not_found"
    | "thread_archived"
    | "chat_azure_config_required"
    | "turn_not_found"
    | "reasoning_effort_not_supported"
    | "web_search_reasoning_effort_not_supported",
  message: string,
): ThreadChatRunError {
  const error = new Error(message) as ThreadChatRunError;
  Object.assign(error, {
    status,
    code,
    name: "ThreadChatRunError",
  });
  return error;
}
