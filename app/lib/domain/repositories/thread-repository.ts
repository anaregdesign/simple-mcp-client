import type { ThreadResource, ThreadWritePayload } from "~/lib/contracts/threads/types";

export type ThreadRecordHead = {
  deletedAt: string | null;
};

export interface ThreadRepository {
  listByUserId(userId: number): Promise<ThreadResource[]>;
  findByIdForUser(userId: number, threadId: string): Promise<ThreadResource | null>;
  readHead(userId: number, threadId: string): Promise<ThreadRecordHead | null>;
  savePayload(
    userId: number,
    payload: ThreadWritePayload,
  ): Promise<{ thread: ThreadResource; created: boolean } | null>;
  setDeletedAt(
    userId: number,
    threadId: string,
    deletedAt: string | null,
  ): Promise<ThreadResource | null>;
}
