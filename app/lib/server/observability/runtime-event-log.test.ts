/**
 * Test module verifying runtime-event-log behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, findByIdForOwnerMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  findByIdForOwnerMock: vi.fn(),
}));

vi.mock(
  "~/lib/server/infrastructure/repositories/runtime-event-log-persistence-repository",
  () => ({
    runtimeEventLogPersistenceRepository: {
      create: createMock,
      findByIdForOwner: findByIdForOwnerMock,
    },
  }),
);

import {
  logRuntimeEvent,
  logRuntimeEventWithId,
  logServerRouteEvent,
} from "./runtime-event-log";

describe("logRuntimeEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue("runtime-event-log-1");
    findByIdForOwnerMock.mockResolvedValue(null);
  });

  it("forwards app event logs to the repository", async () => {
    await logRuntimeEvent({
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

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
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
  });

  it("never throws when repository write fails", async () => {
    createMock.mockRejectedValueOnce(new Error("db failed"));

    await expect(
      logRuntimeEvent({
        source: "server",
        level: "error",
        category: "api",
        eventName: "save_failed",
        message: "save failed",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("logRuntimeEventWithId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue("runtime-event-log-1");
    findByIdForOwnerMock.mockResolvedValue(null);
  });

  it("returns created event log id on success", async () => {
    const eventLogId = await logRuntimeEventWithId({
      source: "server",
      level: "info",
      category: "api",
      eventName: "event_log_created",
      message: "created",
    });

    expect(eventLogId).toBe("runtime-event-log-1");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when repository write fails", async () => {
    createMock.mockRejectedValueOnce(new Error("db failed"));

    await expect(
      logRuntimeEventWithId({
        source: "server",
        level: "error",
        category: "api",
        eventName: "event_log_failed",
        message: "failed",
      }),
    ).resolves.toBeNull();
  });
});

describe("logServerRouteEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue("runtime-event-log-1");
    findByIdForOwnerMock.mockResolvedValue(null);
  });

  it("captures route request metadata and error details", async () => {
    const request = new Request("http://localhost/api/chat?stream=1", {
      method: "POST",
    });

    await logServerRouteEvent({
      request,
      route: "/api/chat",
      eventName: "chat_execution_failed",
      action: "execute_chat",
      statusCode: 502,
      error: new Error("Bad gateway"),
      context: {
        turnId: "turn-1",
      },
    });

    expect(createMock).toHaveBeenCalledWith({
      source: "server",
      level: "error",
      category: "api",
      eventName: "chat_execution_failed",
      message: "Bad gateway",
      errorName: "Error",
      stack: expect.any(String),
      location: "/api/chat",
      action: "execute_chat",
      statusCode: 502,
      httpMethod: "POST",
      httpPath: "/api/chat",
      threadId: null,
      tenantId: null,
      principalId: null,
      userId: null,
      context: {
        turnId: "turn-1",
      },
    });
  });
});

describe("readRuntimeEventLogByIdForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue("runtime-event-log-1");
    findByIdForOwnerMock.mockResolvedValue(null);
  });

  it("returns normalized event log when owner matches", async () => {
    findByIdForOwnerMock.mockResolvedValueOnce({
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
      context: {
        source: "ui",
      },
    });

    const { readRuntimeEventLogByIdForUser } = await import("./runtime-event-log");
    const eventLog = await readRuntimeEventLogByIdForUser({
      eventLogId: "event-1",
      tenantId: "tenant-a",
      principalId: "principal-a",
      userId: 10,
    });

    expect(findByIdForOwnerMock).toHaveBeenCalledWith({
      eventLogId: "event-1",
      tenantId: "tenant-a",
      principalId: "principal-a",
      userId: 10,
    });
    expect(eventLog).not.toBeNull();
    expect(eventLog?.id).toBe("event-1");
    expect(eventLog?.context).toEqual({ source: "ui" });
  });

  it("returns null when event log id is blank", async () => {
    const { readRuntimeEventLogByIdForUser } = await import("./runtime-event-log");
    const eventLog = await readRuntimeEventLogByIdForUser({
      eventLogId: "   ",
      tenantId: "tenant-a",
      principalId: "principal-a",
      userId: 10,
    });

    expect(findByIdForOwnerMock).not.toHaveBeenCalled();
    expect(eventLog).toBeNull();
  });

  it("returns null when event log is not found", async () => {
    const { readRuntimeEventLogByIdForUser } = await import("./runtime-event-log");
    const eventLog = await readRuntimeEventLogByIdForUser({
      eventLogId: "missing",
      tenantId: "tenant-a",
      principalId: "principal-a",
      userId: 10,
    });

    expect(eventLog).toBeNull();
  });
});
