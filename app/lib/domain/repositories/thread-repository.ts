import type { ThreadWritePayload } from "~/lib/contracts/threads/types";
import type { ThreadRecord } from "~/lib/domain/entities/thread-record";

export type ThreadRecordHead = {
  deletedAt: string | null;
};

export interface ThreadRepository {
  listByUserId(userId: number): Promise<ThreadRecord[]>;
  findByIdForUser(userId: number, threadId: string): Promise<ThreadRecord | null>;
  readHead(userId: number, threadId: string): Promise<ThreadRecordHead | null>;
  savePayload(
    userId: number,
    payload: ThreadWritePayload,
  ): Promise<{ thread: ThreadRecord; created: boolean } | null>;
  setDeletedAt(
    userId: number,
    threadId: string,
    deletedAt: string | null,
  ): Promise<ThreadRecord | null>;
}
