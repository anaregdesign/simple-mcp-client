import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import {
  type ThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";
import type { Thread } from "~/lib/domain/entities/thread";
import type { ThreadRepository } from "~/lib/domain/repositories/thread-repository";
import { buildThreadSaveInputFromThread } from "~/lib/server/usecase/threads/thread-save-input-mapper";

export async function persistThreadState(options: {
  thread: Thread;
  userId: number;
  repository: ThreadRepository;
  agentConversationId: string | null;
  threadEnvironment: Record<string, string>;
  operationLogs: ThreadOperationLogEntry[];
  assistantMessage?: ThreadMessage;
  createNotFoundError: () => Error;
}): Promise<Thread> {
  const payload = buildThreadSaveInputFromThread(options.thread, {
    agentConversationId: options.agentConversationId,
    threadEnvironment: options.threadEnvironment,
    operationLogs: options.operationLogs,
    assistantMessage: options.assistantMessage,
  });
  const saved = await options.repository.save(options.userId, payload);
  if (!saved) {
    throw options.createNotFoundError();
  }

  return saved.thread;
}
