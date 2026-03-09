/**
 * Test module verifying POST /api/threads behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadResource, ThreadWritePayload } from "~/lib/contracts/threads/types";

const {
  readAzureArmUserContextMock,
  getOrCreateUserByIdentityMock,
  readThreadWritePayloadFromUnknownMock,
  installGlobalServerErrorLoggingMock,
  logServerRouteEventMock,
} = vi.hoisted(() => ({
  readAzureArmUserContextMock: vi.fn(),
  getOrCreateUserByIdentityMock: vi.fn(),
  readThreadWritePayloadFromUnknownMock: vi.fn(),
  installGlobalServerErrorLoggingMock: vi.fn(),
  logServerRouteEventMock: vi.fn(),
}));

vi.mock("~/lib/server/auth/azure-user", () => ({
  readAzureArmUserContext: readAzureArmUserContextMock,
}));

vi.mock("~/lib/server/persistence/user", () => ({
  getOrCreateUserByIdentity: getOrCreateUserByIdentityMock,
}));

vi.mock("~/lib/contracts/threads/parsers", () => ({
  readThreadWritePayloadFromUnknown: readThreadWritePayloadFromUnknownMock,
}));

vi.mock("~/lib/server/observability/runtime-event-log", () => ({
  installGlobalServerErrorLogging: installGlobalServerErrorLoggingMock,
  logServerRouteEvent: logServerRouteEventMock,
}));

import { action, threadCollectionActionHandlers } from "./api.threads";
const createThreadSpy = vi.spyOn(threadCollectionActionHandlers, "createThread");

function createThreadResource(): ThreadResource {
  return {
    id: "thread-a",
    userId: 10,
    name: "Thread A",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "medium",
    webSearchEnabled: true,
    threadEnvironmentJson: "{}",
    instructionContextTogglesJson: "{\"system\":true}",
    instruction: {
      id: 1,
      threadId: "thread-a",
      content: "",
    },
    messages: [],
    mcpServers: [],
    mcpRpcLogs: [],
    skillSelections: [],
  };
}

describe("POST /api/threads", () => {
  const thread: ThreadWritePayload = {
    id: "thread-a",
    name: "Thread A",
    createdAt: "2026-01-01T00:00:00.000Z",
    reasoningEffort: "medium",
    webSearchEnabled: true,
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    readAzureArmUserContextMock.mockResolvedValue({
      tenantId: "tenant-a",
      principalId: "principal-a",
    });
    getOrCreateUserByIdentityMock.mockResolvedValue({
      id: 10,
      tenantId: "tenant-a",
      principalId: "principal-a",
    });
    readThreadWritePayloadFromUnknownMock.mockReturnValue(thread);
    logServerRouteEventMock.mockResolvedValue(undefined);
    createThreadSpy.mockReset();
    createThreadSpy.mockResolvedValue({
      status: "created",
      thread: createThreadResource(),
    });
  });

  it("returns 201 with Location when thread is created", async () => {
    const response = await action({
      request: new Request("http://localhost/api/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    } as never);

    const payload = (await response.json()) as { thread?: ThreadResource };
    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe("/api/threads/thread-a");
    expect(payload.thread?.id).toBe("thread-a");
  });

  it("returns 409 when thread id already exists", async () => {
    createThreadSpy.mockResolvedValueOnce({
      status: "conflict",
    });

    const response = await action({
      request: new Request("http://localhost/api/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    } as never);

    const payload = (await response.json()) as { error?: string };
    expect(response.status).toBe(409);
    expect(payload.error).toBe("Thread id already exists.");
  });

  it("returns 422 when payload is invalid", async () => {
    readThreadWritePayloadFromUnknownMock.mockReturnValueOnce(null);

    const response = await action({
      request: new Request("http://localhost/api/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invalid: true }),
      }),
    } as never);

    const payload = (await response.json()) as { error?: string };
    expect(response.status).toBe(422);
    expect(payload.error).toBe("Invalid thread payload.");
  });

  it("returns 401 when user is not authenticated", async () => {
    readAzureArmUserContextMock.mockResolvedValueOnce(null);

    const response = await action({
      request: new Request("http://localhost/api/threads", {
        method: "POST",
      }),
    } as never);

    const payload = (await response.json()) as { authRequired?: boolean };
    expect(response.status).toBe(401);
    expect(payload.authRequired).toBe(true);
  });
});
