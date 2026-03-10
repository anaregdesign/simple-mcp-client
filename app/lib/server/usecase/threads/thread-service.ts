/**
 * Thread application service module.
 */
import type { Thread } from "~/lib/domain/entities/thread";
import type {
  ThreadRepository,
  ThreadSaveInput,
} from "~/lib/domain/repositories/thread-repository";

export class ThreadQueryService {
  constructor(private readonly repository: ThreadRepository) {}

  async readUserThreads(userId: number): Promise<Thread[]> {
    return await this.repository.listByUserId(userId);
  }
}

export class ThreadApplicationService {
  constructor(private readonly repository: ThreadRepository) {}

  async createThread(
    userId: number,
    payload: ThreadSaveInput,
  ): Promise<CreateThreadResult> {
    return createThread(this.repository, userId, payload);
  }

  async updateThread(
    userId: number,
    payload: ThreadSaveInput,
  ): Promise<UpdateThreadResult> {
    return updateThread(this.repository, userId, payload);
  }

  async logicalDeleteThread(
    userId: number,
    threadId: string,
  ): Promise<LogicalDeleteThreadResult> {
    return logicalDeleteThread(this.repository, userId, threadId);
  }

  async logicalRestoreThread(
    userId: number,
    threadId: string,
  ): Promise<LogicalRestoreThreadResult> {
    return logicalRestoreThread(this.repository, userId, threadId);
  }
}

export function createThreadQueryService(
  repository: ThreadRepository,
): ThreadQueryService {
  return new ThreadQueryService(repository);
}

export function createThreadApplicationService(
  repository: ThreadRepository,
): ThreadApplicationService {
  return new ThreadApplicationService(repository);
}

export type CreateThreadResult =
  | {
      status: "created";
      thread: Thread;
    }
  | {
      status: "conflict";
    }
  | {
      status: "invalid";
    };

async function createThread(
  repository: ThreadRepository,
  userId: number,
  payload: ThreadSaveInput,
): Promise<CreateThreadResult> {
  const existing = await repository.readLifecycleState(userId, payload.id);
  if (existing) {
    return {
      status: "conflict",
    };
  }

  try {
    const saved = await saveThread(repository, userId, payload);
    if (!saved || !saved.created) {
      return {
        status: "invalid",
      };
    }

    return {
      status: "created",
      thread: saved.thread,
    };
  } catch (error) {
    if (isThreadIdConflictError(error)) {
      return {
        status: "conflict",
      };
    }
    throw error;
  }
}

export type UpdateThreadResult =
  | {
      status: "ok";
      thread: Thread;
    }
  | {
      status: "not_found";
    }
  | {
      status: "archived";
    };

async function updateThread(
  repository: ThreadRepository,
  userId: number,
  payload: ThreadSaveInput,
): Promise<UpdateThreadResult> {
  const existing = await repository.readLifecycleState(userId, payload.id);
  if (!existing) {
    return { status: "not_found" };
  }
  if (existing.deletedAt !== null) {
    return { status: "archived" };
  }

  const saved = await saveThread(repository, userId, payload);
  if (!saved || saved.created) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    thread: saved.thread,
  };
}

async function saveThread(
  repository: ThreadRepository,
  userId: number,
  payload: ThreadSaveInput,
): Promise<{ thread: Thread; created: boolean } | null> {
  return repository.save(userId, payload);
}

export type LogicalDeleteThreadResult =
  | {
      status: "not_found";
    }
  | {
      status: "ok";
      thread: Thread;
    };

async function logicalDeleteThread(
  repository: ThreadRepository,
  userId: number,
  threadId: string,
): Promise<LogicalDeleteThreadResult> {
  const existing = await repository.findByIdForUser(userId, threadId);
  if (!existing) {
    return { status: "not_found" };
  }
  if (existing.isArchived()) {
    return {
      status: "ok",
      thread: existing,
    };
  }

  const deleted = await repository.setDeletedAt(userId, threadId, existing.archive(new Date().toISOString()).deletedAt);
  if (!deleted) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    thread: deleted,
  };
}

export type LogicalRestoreThreadResult =
  | {
      status: "not_found";
    }
  | {
      status: "ok";
      thread: Thread;
    };

async function logicalRestoreThread(
  repository: ThreadRepository,
  userId: number,
  threadId: string,
): Promise<LogicalRestoreThreadResult> {
  const existing = await repository.findByIdForUser(userId, threadId);
  if (!existing) {
    return { status: "not_found" };
  }
  if (!existing.isArchived()) {
    return {
      status: "ok",
      thread: existing,
    };
  }

  const restored = await repository.setDeletedAt(
    userId,
    threadId,
    existing.restore().deletedAt,
  );
  if (!restored) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    thread: restored,
  };
}

function isThreadIdConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    meta?: {
      target?: unknown;
    };
  };
  if (candidate.code !== "P2002") {
    return false;
  }

  const target = candidate.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("id");
  }
  if (typeof target === "string") {
    return target.includes("id");
  }

  return false;
}

export function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
