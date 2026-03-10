/**
 * Test module verifying api.threads.$threadId behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadSnapshot } from "~/lib/domain/value-objects/thread-snapshot";
import { Thread } from "~/lib/domain/entities/thread";

const {
  readAuthenticatedUser,
  createThreadApplicationService,
  updateThread,
  logicalDeleteThread,
  logicalRestoreThread,
  isThreadRestorePayload,
  readThreadWritePayloadFromUnknown,
  logServerRouteEvent,
} = vi.hoisted(() => ({
  readAuthenticatedUser: vi.fn(async () => ({ id: 1 })),
  createThreadApplicationService: vi.fn(),
  updateThread: vi.fn<any>(async () => ({ status: "not_found" })),
  logicalDeleteThread: vi.fn<any>(async () => ({ status: "not_found" as const })),
  logicalRestoreThread: vi.fn(async () => ({ status: "not_found" as const })),
  isThreadRestorePayload: vi.fn(() => false),
  readThreadWritePayloadFromUnknown: vi.fn<any>(() => null),
  logServerRouteEvent: vi.fn(async () => undefined),
}));

vi.mock("~/lib/server/infrastructure/auth/read-authenticated-user", () => ({
  readAuthenticatedUser,
}));

vi.mock("~/lib/server/usecase/threads/thread-service", async () => {
  const actual = await vi.importActual<
    typeof import("~/lib/server/usecase/threads/thread-service")
  >("~/lib/server/usecase/threads/thread-service");

  return {
    ...actual,
    createThreadApplicationService:
      createThreadApplicationService.mockReturnValue({
        updateThread,
        logicalDeleteThread,
        logicalRestoreThread,
      }),
    isThreadRestorePayload,
  };
});

vi.mock("~/lib/contracts/threads/parsers", () => ({
  readThreadWritePayloadFromUnknown,
}));

vi.mock("~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway", () => ({
  installGlobalServerErrorLogging: vi.fn(),
  logServerRouteEvent,
}));

import { action, loader } from "./api.threads.$threadId";

function createThreadProps(threadId = "thread-a"): ThreadSnapshot {
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
    messages: [],
    mcpServers: [],
    operationLogs: [],
    skillSelections: [],
  };
}

function createThread(threadId = "thread-a"): Thread {
  return new Thread(createThreadProps(threadId));
}

describe("/api/threads/:threadId", () => {
  beforeEach(() => {
    readAuthenticatedUser.mockReset();
    readAuthenticatedUser.mockResolvedValue({ id: 1 });
    createThreadApplicationService.mockClear();
    updateThread.mockReset();
    updateThread.mockResolvedValue({ status: "not_found" });
    logicalDeleteThread.mockReset();
    logicalDeleteThread.mockResolvedValue({ status: "not_found" });
    logicalRestoreThread.mockReset();
    logicalRestoreThread.mockResolvedValue({ status: "not_found" });
    isThreadRestorePayload.mockReset();
    isThreadRestorePayload.mockReturnValue(false);
    readThreadWritePayloadFromUnknown.mockReset();
    readThreadWritePayloadFromUnknown.mockReturnValue(null);
    logServerRouteEvent.mockReset();
    logServerRouteEvent.mockResolvedValue(undefined);
  });

  it("returns 405 response with Allow header for loader", async () => {
    const response = loader();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("PUT, PATCH, DELETE");
  });

  it("returns 405 for unsupported methods", async () => {
    const response = await action({
      request: new Request("http://localhost/api/threads/thread-a", { method: "GET" }),
      params: { threadId: "thread-a" },
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("PUT, PATCH, DELETE");
  });

  it("returns 422 when PUT payload thread id does not match path id", async () => {
    readThreadWritePayloadFromUnknown.mockReturnValue({
      id: "thread-b",
      name: "Thread B",
      createdAt: "2026-01-01T00:00:00.000Z",
      reasoningEffort: "medium",
      webSearchEnabled: false,
      instruction: {
        content: "",
      },
      instructionContextToggles: {
        system: true,
      },
      threadEnvironment: {},
      messages: [],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    });

    const response = await action({
      request: new Request("http://localhost/api/threads/thread-a", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      params: { threadId: "thread-a" },
    } as never);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(422);
    expect(payload.error).toBe("`thread.id` must match path `threadId`.");
  });

  it("returns 404 when PUT target thread does not exist", async () => {
    readThreadWritePayloadFromUnknown.mockReturnValue({
      id: "thread-a",
      name: "Thread A",
      createdAt: "2026-01-01T00:00:00.000Z",
      reasoningEffort: "medium",
      webSearchEnabled: false,
      instruction: {
        content: "",
      },
      instructionContextToggles: {
        system: true,
      },
      threadEnvironment: {},
      messages: [],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    });
    updateThread.mockResolvedValueOnce({ status: "not_found" });

    const response = await action({
      request: new Request("http://localhost/api/threads/thread-a", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      params: { threadId: "thread-a" },
    } as never);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Thread is not available.");
  });

  it("returns 200 on successful PUT update", async () => {
    readThreadWritePayloadFromUnknown.mockReturnValue({
      id: "thread-a",
      name: "Thread A",
      createdAt: "2026-01-01T00:00:00.000Z",
      reasoningEffort: "medium",
      webSearchEnabled: false,
      instruction: {
        content: "",
      },
      instructionContextToggles: {
        system: true,
      },
      threadEnvironment: {},
      messages: [],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    });
    updateThread.mockResolvedValueOnce({
      status: "ok",
      thread: createThread("thread-a"),
    });

    const response = await action({
      request: new Request("http://localhost/api/threads/thread-a", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      params: { threadId: "thread-a" },
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("returns 409 when PUT target thread is archived", async () => {
    readThreadWritePayloadFromUnknown.mockReturnValue({
      id: "thread-a",
      name: "Thread A",
      createdAt: "2026-01-01T00:00:00.000Z",
      reasoningEffort: "medium",
      webSearchEnabled: false,
      instruction: {
        content: "",
      },
      instructionContextToggles: {
        system: true,
      },
      threadEnvironment: {},
      messages: [],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    });
    updateThread.mockResolvedValueOnce({ status: "archived" });

    const response = await action({
      request: new Request("http://localhost/api/threads/thread-a", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      params: { threadId: "thread-a" },
    } as never);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(payload.error).toBe("Archived thread is read-only. Restore it from Archives to update.");
  });

  it("returns 200 when deleting an empty persisted thread", async () => {
    logicalDeleteThread.mockResolvedValueOnce({
      status: "ok",
      thread: new Thread({
        ...createThreadProps("thread-a"),
        deletedAt: "2026-03-10T00:00:00.000Z",
      }),
    });

    const response = await action({
      request: new Request("http://localhost/api/threads/thread-a", { method: "DELETE" }),
      params: { threadId: "thread-a" },
    } as never);
    const payload = (await response.json()) as { error?: string; thread?: { deletedAt?: string | null } };

    expect(response.status).toBe(200);
    expect(payload.thread?.deletedAt).toBe("2026-03-10T00:00:00.000Z");
  });
});
