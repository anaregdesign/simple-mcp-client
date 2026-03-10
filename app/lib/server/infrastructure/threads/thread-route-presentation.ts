import type { ThreadResource } from "~/lib/contracts/threads/types";
import type { Thread } from "~/lib/domain/entities/thread";
import { presentThreadResource } from "~/lib/server/infrastructure/threads/thread-resource-presentation";
import type {
  CreateThreadResult,
  LogicalDeleteThreadResult,
  LogicalRestoreThreadResult,
  UpdateThreadResult,
} from "~/lib/server/usecase/threads/thread-service";

type ThreadRouteLogLevel = "info" | "warning";

type ThreadRoutePresentationBase = {
  action: string;
  eventName: string;
  message: string;
  statusCode: number;
};

export type ThreadRouteErrorPresentation = ThreadRoutePresentationBase & {
  kind: "error";
  code: string;
  error: string;
  level: ThreadRouteLogLevel;
};

export type ThreadRouteSuccessPresentation = ThreadRoutePresentationBase & {
  kind: "success";
  level: ThreadRouteLogLevel;
  thread: ThreadResource;
  headers?: HeadersInit;
  context?: Record<string, number>;
};

export type ThreadRoutePresentation =
  | ThreadRouteErrorPresentation
  | ThreadRouteSuccessPresentation;

export type ThreadUnexpectedFailureOperation =
  | "load_threads"
  | "create_thread"
  | "update_thread"
  | "delete_thread"
  | "restore_thread";

export function buildThreadCollectionMetricsContext(
  threads: Thread[],
): Record<string, number> {
  return {
    threadCount: threads.length,
    archivedThreadCount: threads.filter((thread) => thread.deletedAt !== null).length,
  };
}

export function buildThreadMutationMetricsContext(
  thread: Thread,
): Record<string, number> {
  return {
    messageCount: thread.messages.length,
    mcpServerCount: thread.mcpServers.length,
    operationLogCount: thread.operationLogs.length,
    skillSelectionCount: thread.skillSelections.length,
  };
}

export function presentCreateThreadResult(
  result: CreateThreadResult,
): ThreadRoutePresentation {
  if (result.status === "created") {
    return {
      kind: "success",
      action: "create_thread",
      eventName: "create_thread_succeeded",
      level: "info",
      statusCode: 201,
      message: "Thread created.",
      thread: presentThreadResource(result.thread),
      headers: {
        Location: `/api/threads/${encodeURIComponent(result.thread.id)}`,
      },
      context: buildThreadMutationMetricsContext(result.thread),
    };
  }

  if (result.status === "conflict") {
    return {
      kind: "error",
      action: "create_thread",
      eventName: "thread_conflict",
      level: "warning",
      statusCode: 409,
      code: "thread_conflict",
      error: "Thread id already exists.",
      message: "Thread id already exists.",
    };
  }

  return {
    kind: "error",
    action: "create_thread",
    eventName: "invalid_thread_payload",
    level: "warning",
    statusCode: 422,
    code: "invalid_thread_payload",
    error: "Thread payload is not persistable.",
    message: "Thread payload is not persistable.",
  };
}

export function presentUpdateThreadResult(
  result: UpdateThreadResult,
): ThreadRoutePresentation {
  if (result.status === "ok") {
    return {
      kind: "success",
      action: "update_thread",
      eventName: "update_thread_succeeded",
      level: "info",
      statusCode: 200,
      message: "Thread updated.",
      thread: presentThreadResource(result.thread),
      context: buildThreadMutationMetricsContext(result.thread),
    };
  }

  if (result.status === "archived") {
    const errorMessage =
      "Archived thread is read-only. Restore it from Archives to update.";
    return {
      kind: "error",
      action: "update_thread",
      eventName: "thread_archived_conflict",
      level: "warning",
      statusCode: 409,
      code: "thread_archived_conflict",
      error: errorMessage,
      message: errorMessage,
    };
  }

  return threadNotFoundPresentation("update_thread");
}

export function presentDeleteThreadResult(
  result: LogicalDeleteThreadResult,
): ThreadRoutePresentation {
  if (result.status === "ok") {
    return {
      kind: "success",
      action: "delete_thread",
      eventName: "delete_thread_succeeded",
      level: "info",
      statusCode: 200,
      message: "Thread archived.",
      thread: presentThreadResource(result.thread),
    };
  }

  if (result.status === "empty") {
    return {
      kind: "error",
      action: "delete_thread",
      eventName: "thread_delete_disallowed_empty",
      level: "warning",
      statusCode: 409,
      code: "thread_delete_disallowed_empty",
      error: "Threads without messages cannot be deleted.",
      message: "Threads without messages cannot be deleted.",
    };
  }

  return threadNotFoundPresentation("delete_thread");
}

export function presentRestoreThreadResult(
  result: LogicalRestoreThreadResult,
): ThreadRoutePresentation {
  if (result.status === "ok") {
    return {
      kind: "success",
      action: "restore_thread",
      eventName: "restore_thread_succeeded",
      level: "info",
      statusCode: 200,
      message: "Thread restored.",
      thread: presentThreadResource(result.thread),
    };
  }

  return threadNotFoundPresentation("restore_thread");
}

export function describeUnexpectedThreadFailure(
  operation: ThreadUnexpectedFailureOperation,
): {
  action: ThreadUnexpectedFailureOperation;
  eventName: `${ThreadUnexpectedFailureOperation}_failed`;
  code: `${ThreadUnexpectedFailureOperation}_failed`;
  message: string;
} {
  const messages: Record<ThreadUnexpectedFailureOperation, string> = {
    load_threads: "Failed to load threads from database",
    create_thread: "Failed to create thread in database",
    update_thread: "Failed to update thread in database",
    delete_thread: "Failed to archive thread in database",
    restore_thread: "Failed to restore thread in database",
  };

  return {
    action: operation,
    eventName: `${operation}_failed`,
    code: `${operation}_failed`,
    message: messages[operation],
  };
}

function threadNotFoundPresentation(
  action: "update_thread" | "delete_thread" | "restore_thread",
): ThreadRouteErrorPresentation {
  return {
    kind: "error",
    action,
    eventName: "thread_not_found",
    level: "warning",
    statusCode: 404,
    code: "thread_not_found",
    error: "Thread is not available.",
    message: "Thread is not available.",
  };
}
