import { describe, expect, it, vi } from "vitest";
import { ClientApiError } from "~/lib/client/infrastructure/api/api-client";
import type { ThreadWritePayload } from "~/lib/contracts/threads/types";
import {
  ThreadsApiClient,
} from "~/lib/client/infrastructure/api/threads-api-client";

function createThreadWritePayload(): ThreadWritePayload {
  return {
    id: "thread-1",
    name: "Thread 1",
    createdAt: "2026-01-01T00:00:00.000Z",
    reasoningEffort: "high",
    webSearchEnabled: false,
    instruction: {
      content: "Instruction",
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
}

describe("ThreadsApiClient", () => {
  it("loads threads", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/threads");
      expect(init?.method).toBe("GET");

      return new Response(
        JSON.stringify({
          threads: [
            {
              id: "thread-1",
            },
          ],
        }),
        { status: 200 },
      );
    });

    const client = new ThreadsApiClient();
    const result = await client.loadThreads({ fetchImpl });

    expect(result.threads).toEqual([{ id: "thread-1" }]);
  });

  it("posts thread payloads when creating", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/threads");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify(createThreadWritePayload()));

      return new Response(
        JSON.stringify({
          thread: {
            id: "thread-1",
          },
        }),
        { status: 200 },
      );
    });

    const client = new ThreadsApiClient();
    const result = await client.saveThread(createThreadWritePayload(), {
      fetchImpl,
    });

    expect(result.thread).toEqual({ id: "thread-1" });
  });

  it("uses PUT when updating an existing thread", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/threads/thread-1");
      expect(init?.method).toBe("PUT");

      return new Response(
        JSON.stringify({
          thread: {
            id: "thread-1",
          },
        }),
        { status: 200 },
      );
    });

    const client = new ThreadsApiClient();
    await client.saveThread(createThreadWritePayload(), {
      isUpdate: true,
      fetchImpl,
    });
  });

  it("surfaces auth_required responses for delete", async () => {
    const onAuthRequired = vi.fn();
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: "Azure authentication failed.",
          authRequired: true,
        }),
        { status: 401 },
      );
    });

    const client = new ThreadsApiClient();

    await expect(
      client.deleteThread("thread-1", {
        fetchImpl,
        onAuthRequired,
      }),
    ).rejects.toMatchObject({
      kind: "auth_required",
      message: "Azure login is required. Open Settings and sign in to continue.",
    } satisfies Partial<ClientApiError>);

    expect(onAuthRequired).toHaveBeenCalledTimes(1);
  });

  it("patches archived state when restoring", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/threads/thread-1");
      expect(init?.method).toBe("PATCH");
      expect(init?.body).toBe(JSON.stringify({ archived: false }));

      return new Response(
        JSON.stringify({
          thread: {
            id: "thread-1",
          },
        }),
        { status: 200 },
      );
    });

    const client = new ThreadsApiClient();
    await client.restoreThread("thread-1", { fetchImpl });
  });
});
