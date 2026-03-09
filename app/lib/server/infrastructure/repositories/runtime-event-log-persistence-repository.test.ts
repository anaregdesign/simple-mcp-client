import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ensurePersistenceDatabaseReadyMock,
  runtimeEventLogCreateMock,
  runtimeEventLogFindFirstMock,
} = vi.hoisted(() => ({
  ensurePersistenceDatabaseReadyMock: vi.fn(),
  runtimeEventLogCreateMock: vi.fn(),
  runtimeEventLogFindFirstMock: vi.fn(),
}));

vi.mock("~/lib/server/infrastructure/persistence/prisma", () => ({
  ensurePersistenceDatabaseReady: ensurePersistenceDatabaseReadyMock,
  prisma: {
    runtimeEventLog: {
      create: runtimeEventLogCreateMock,
      findFirst: runtimeEventLogFindFirstMock,
    },
  },
}));

import { runtimeEventLogPersistenceRepository } from "./runtime-event-log-persistence-repository";

describe("RuntimeEventLogPersistenceRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensurePersistenceDatabaseReadyMock.mockResolvedValue(undefined);
    runtimeEventLogCreateMock.mockResolvedValue(undefined);
    runtimeEventLogFindFirstMock.mockResolvedValue(null);
  });

  it("writes normalized app event logs to prisma", async () => {
    await runtimeEventLogPersistenceRepository.create({
      source: "server",
      level: "error",
      category: "api",
      eventName: "chat_execution_failed",
      message: "upstream timeout",
      statusCode: 502,
      httpMethod: "POST",
      httpPath: "/api/chat",
      context: {
        attempt: 1,
      },
    });

    expect(ensurePersistenceDatabaseReadyMock).toHaveBeenCalledTimes(1);
    expect(runtimeEventLogCreateMock).toHaveBeenCalledTimes(1);
    const call = runtimeEventLogCreateMock.mock.calls[0]?.[0] as {
      data: {
        contextJson: string;
        source: string;
        level: string;
        category: string;
        eventName: string;
      };
    };
    expect(call.data.source).toBe("server");
    expect(call.data.level).toBe("error");
    expect(call.data.category).toBe("api");
    expect(call.data.eventName).toBe("chat_execution_failed");
    expect(JSON.parse(call.data.contextJson)).toEqual({
      attempt: 1,
    });
  });

  it("returns null when database write fails", async () => {
    runtimeEventLogCreateMock.mockRejectedValueOnce(new Error("db failed"));

    await expect(
      runtimeEventLogPersistenceRepository.create({
        source: "server",
        level: "error",
        category: "api",
        eventName: "event_log_failed",
        message: "failed",
      }),
    ).resolves.toBeNull();
  });

  it("returns normalized event log when owner matches", async () => {
    runtimeEventLogFindFirstMock.mockResolvedValueOnce({
      id: "event-1",
      createdAt: "2026-03-01T00:00:00.000Z",
      source: "client",
      level: "info",
      category: "frontend",
      eventName: "event_name",
      message: "message",
      errorName: null,
      location: null,
      action: "click",
      statusCode: 200,
      httpMethod: "GET",
      httpPath: "/api/runtime/event-logs/event-1",
      threadId: "thread-1",
      tenantId: "tenant-a",
      principalId: "principal-a",
      userId: 10,
      stack: null,
      contextJson: "{\"source\":\"ui\"}",
    });

    const eventLog = await runtimeEventLogPersistenceRepository.findByIdForOwner({
      eventLogId: "event-1",
      tenantId: "tenant-a",
      principalId: "principal-a",
      userId: 10,
    });

    expect(runtimeEventLogFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: "event-1",
        OR: [
          {
            tenantId: "tenant-a",
            principalId: "principal-a",
          },
          {
            userId: 10,
          },
        ],
      },
    });
    expect(eventLog).not.toBeNull();
    expect(eventLog?.id).toBe("event-1");
    expect(eventLog?.context).toEqual({ source: "ui" });
  });

  it("returns null when no owner filter can be built", async () => {
    const eventLog = await runtimeEventLogPersistenceRepository.findByIdForOwner({
      eventLogId: "event-1",
      tenantId: "   ",
      principalId: "   ",
      userId: null,
    });

    expect(runtimeEventLogFindFirstMock).not.toHaveBeenCalled();
    expect(eventLog).toBeNull();
  });
});
