/**
 * Test module verifying /api/runtime/event-logs/:eventLogId behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readRuntimeEventLogForCurrentUserMock,
  installGlobalServerErrorLoggingMock,
  logServerRouteEventMock,
} = vi.hoisted(() => ({
  readRuntimeEventLogForCurrentUserMock: vi.fn(),
  installGlobalServerErrorLoggingMock: vi.fn(),
  logServerRouteEventMock: vi.fn(),
}));

vi.mock("~/lib/server/application/runtime-event-logs/runtime-event-log-service", () => ({
  runtimeEventLogService: {
    readRuntimeEventLogForCurrentUser: readRuntimeEventLogForCurrentUserMock,
  },
}));

vi.mock("~/lib/server/observability/runtime-event-log", () => ({
  installGlobalServerErrorLogging: installGlobalServerErrorLoggingMock,
  logServerRouteEvent: logServerRouteEventMock,
}));

import { action, loader } from "./api.runtime.event-logs.$eventLogId";

describe("/api/runtime/event-logs/:eventLogId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readRuntimeEventLogForCurrentUserMock.mockResolvedValue({
      status: "ok",
      tenantId: "tenant-a",
      principalId: "principal-a",
      userId: 10,
      eventLog: {
        id: "event-1",
        context: { origin: "client" },
      },
    });
    logServerRouteEventMock.mockResolvedValue(undefined);
  });

  it("returns 405 for action", async () => {
    const response = action();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });

  it("returns 422 for empty eventLogId", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/runtime/event-logs/", { method: "GET" }),
      params: { eventLogId: "" },
    } as never);

    expect(response.status).toBe(422);
  });

  it("returns 401 when unauthenticated", async () => {
    readRuntimeEventLogForCurrentUserMock.mockResolvedValueOnce({
      status: "auth_required",
    });

    const response = await loader({
      request: new Request("http://localhost/api/runtime/event-logs/event-1", { method: "GET" }),
      params: { eventLogId: "event-1" },
    } as never);

    expect(response.status).toBe(401);
  });

  it("returns 404 for inaccessible event log", async () => {
    readRuntimeEventLogForCurrentUserMock.mockResolvedValueOnce({
      status: "not_found",
      tenantId: "tenant-a",
      principalId: "principal-a",
      userId: 10,
    });

    const response = await loader({
      request: new Request("http://localhost/api/runtime/event-logs/event-1", { method: "GET" }),
      params: { eventLogId: "event-1" },
    } as never);

    expect(response.status).toBe(404);
  });

  it("returns 200 with eventLog for matching owner", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/runtime/event-logs/event-1", { method: "GET" }),
      params: { eventLogId: "event-1" },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      eventLog: {
        id: "event-1",
        context: { origin: "client" },
      },
    });
  });
});
