import { describe, expect, it } from "vitest";
import {
  ThreadRecord,
  type ThreadRecordSnapshot,
} from "~/lib/domain/entities/thread-record";
import {
  buildThreadCollectionMetricsContext,
  buildThreadMutationMetricsContext,
  describeUnexpectedThreadFailure,
  presentCreateThreadResult,
  presentDeleteThreadResult,
  presentRestoreThreadResult,
  presentUpdateThreadResult,
} from "~/lib/server/http/threads/thread-route-presentation";

function createThreadResource(threadId = "thread-a"): ThreadRecordSnapshot {
  return {
    id: threadId,
    userId: 1,
    name: "Thread A",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "medium",
    webSearchEnabled: false,
    threadEnvironment: {},
    instructionContextToggles: { system: true },
    instruction: {
      id: 1,
      threadId,
      content: "",
    },
    messages: [
      {
        id: "message-a",
        threadId,
        conversationOrder: 0,
        role: "user",
        content: "hello",
        createdAt: "2026-01-01T00:00:00.000Z",
        turnId: "turn-a",
        attachments: [],
        skillActivations: [],
      },
    ],
    mcpServers: [
      {
        id: "server-a",
        threadId,
        selectionOrder: 0,
        name: "Server A",
        transport: "stdio",
        command: "node",
        args: [],
        cwd: null,
        env: {},
      },
    ],
    mcpRpcLogs: [
      {
        rowId: "row-a",
        sourceRpcId: "rpc-a",
        threadId,
        conversationOrder: 0,
        sequence: 0,
        operationType: "mcp",
        serverName: "server-a",
        method: "tools/list",
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:01.000Z",
        request: {},
        response: {},
        isError: false,
        turnId: "turn-a",
      },
    ],
    skillSelections: [
      {
        id: "selection-a",
        threadId,
        selectionOrder: 0,
        skillProfileId: 1,
        skillProfile: {
          id: 1,
          userId: 1,
          registryProfileId: null,
          name: "skill-a",
          location: "/tmp/skill-a",
          source: "workspace",
        },
      },
    ],
  };
}

function createThreadRecord(threadId = "thread-a"): ThreadRecord {
  return new ThreadRecord(createThreadResource(threadId));
}

describe("thread-route-presentation", () => {
  it("builds collection metrics from thread snapshots", () => {
    const activeThread = createThreadRecord("thread-a");
    const archivedThread = new ThreadRecord({
      ...createThreadResource("thread-b"),
      deletedAt: "2026-01-03T00:00:00.000Z",
    });

    expect(
      buildThreadCollectionMetricsContext([activeThread, archivedThread]),
    ).toEqual({
      threadCount: 2,
      archivedThreadCount: 1,
    });
  });

  it("builds mutation metrics from a single thread", () => {
    expect(buildThreadMutationMetricsContext(createThreadRecord())).toEqual({
      messageCount: 1,
      mcpServerCount: 1,
      operationLogCount: 1,
      skillSelectionCount: 1,
    });
  });

  it("presents create thread outcomes", () => {
    const created = presentCreateThreadResult({
      status: "created",
      thread: createThreadRecord(),
    });
    const conflict = presentCreateThreadResult({ status: "conflict" });
    const invalid = presentCreateThreadResult({ status: "invalid" });

    expect(created).toMatchObject({
      kind: "success",
      statusCode: 201,
      eventName: "create_thread_succeeded",
      headers: {
        Location: "/api/threads/thread-a",
      },
    });
    expect(conflict).toMatchObject({
      kind: "error",
      statusCode: 409,
      code: "thread_conflict",
    });
    expect(invalid).toMatchObject({
      kind: "error",
      statusCode: 422,
      code: "invalid_thread_payload",
    });
  });

  it("presents update thread outcomes", () => {
    expect(
      presentUpdateThreadResult({
        status: "ok",
        thread: createThreadRecord(),
      }),
    ).toMatchObject({
      kind: "success",
      statusCode: 200,
      eventName: "update_thread_succeeded",
    });
    expect(presentUpdateThreadResult({ status: "archived" })).toMatchObject({
      kind: "error",
      statusCode: 409,
      code: "thread_archived_conflict",
    });
    expect(presentUpdateThreadResult({ status: "not_found" })).toMatchObject({
      kind: "error",
      statusCode: 404,
      code: "thread_not_found",
    });
  });

  it("presents delete and restore outcomes", () => {
    expect(
      presentDeleteThreadResult({
        status: "ok",
        thread: createThreadRecord(),
      }),
    ).toMatchObject({
      kind: "success",
      statusCode: 200,
      eventName: "delete_thread_succeeded",
    });
    expect(presentDeleteThreadResult({ status: "empty" })).toMatchObject({
      kind: "error",
      statusCode: 409,
      code: "thread_delete_disallowed_empty",
    });
    expect(presentRestoreThreadResult({ status: "not_found" })).toMatchObject({
      kind: "error",
      statusCode: 404,
      code: "thread_not_found",
    });
  });

  it("describes unexpected failure metadata per thread operation", () => {
    expect(describeUnexpectedThreadFailure("load_threads")).toEqual({
      action: "load_threads",
      eventName: "load_threads_failed",
      code: "load_threads_failed",
      message: "Failed to load threads from database",
    });
    expect(describeUnexpectedThreadFailure("delete_thread")).toEqual({
      action: "delete_thread",
      eventName: "delete_thread_failed",
      code: "delete_thread_failed",
      message: "Failed to archive thread in database",
    });
    expect(describeUnexpectedThreadFailure("restore_thread")).toEqual({
      action: "restore_thread",
      eventName: "restore_thread_failed",
      code: "restore_thread_failed",
      message: "Failed to restore thread in database",
    });
  });
});
