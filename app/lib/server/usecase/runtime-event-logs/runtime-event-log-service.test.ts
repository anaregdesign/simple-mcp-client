import { describe, expect, it, vi } from "vitest";
import type { RuntimeEventLogRepository } from "~/lib/domain/repositories/runtime-event-log-repository";
import {
  createRuntimeEventLogService,
} from "~/lib/server/usecase/runtime-event-logs/runtime-event-log-service";

function createRepositoryMock(): RuntimeEventLogRepository {
  return {
    create: vi.fn(),
    findByIdForOwner: vi.fn(),
  };
}

describe("RuntimeEventLogService", () => {
  it("returns not_found when the repository does not find a visible event log", async () => {
    const repository = createRepositoryMock();
    vi.mocked(repository.findByIdForOwner).mockResolvedValue(null);
    const service = createRuntimeEventLogService(repository);

    const result = await service.readRuntimeEventLogForUser("event-1", {
      tenantId: "tenant-a",
      principalId: "principal-a",
      userId: 1,
    });

    expect(result).toEqual({ status: "not_found" });
    expect(repository.findByIdForOwner).toHaveBeenCalledWith({
      eventLogId: "event-1",
      tenantId: "tenant-a",
      principalId: "principal-a",
      userId: 1,
    });
  });

  it("returns the event log when the repository matches the owner", async () => {
    const repository = createRepositoryMock();
    vi.mocked(repository.findByIdForOwner).mockResolvedValue({
      id: "event-1",
      createdAt: "2026-03-09T00:00:00.000Z",
      source: "server",
      level: "info",
      category: "api",
      eventName: "loaded",
      message: "Loaded.",
      errorName: null,
      location: "/api/runtime/event-logs/:eventLogId",
      action: "read",
      statusCode: 200,
      httpMethod: "GET",
      httpPath: "/api/runtime/event-logs/event-1",
      threadId: null,
      tenantId: "tenant-a",
      principalId: "principal-a",
      userId: 1,
      stack: null,
      context: {},
    });
    const service = createRuntimeEventLogService(repository);

    const result = await service.readRuntimeEventLogForUser("event-1", {
      tenantId: "tenant-a",
      principalId: "principal-a",
      userId: 1,
    });

    expect(result).toEqual({
      status: "ok",
      eventLog: {
        id: "event-1",
        createdAt: "2026-03-09T00:00:00.000Z",
        source: "server",
        level: "info",
        category: "api",
        eventName: "loaded",
        message: "Loaded.",
        errorName: null,
        location: "/api/runtime/event-logs/:eventLogId",
        action: "read",
        statusCode: 200,
        httpMethod: "GET",
        httpPath: "/api/runtime/event-logs/event-1",
        threadId: null,
        tenantId: "tenant-a",
        principalId: "principal-a",
        userId: 1,
        stack: null,
        context: {},
      },
    });
  });
});
