import { describe, expect, it } from "vitest";
import { createThreadStateUpdaters } from "~/lib/client/usecase/workspace/threads/state-updaters";
import type { ThreadState } from "~/lib/contracts/threads/types";

describe("threads/state-updaters", () => {
  function createThread(): ThreadState {
    return {
      id: "thread-1",
      name: "Thread",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      deletedAt: null,
      reasoningEffort: "medium",
      webSearchEnabled: false,
      agentInstruction: "",
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

  it("updates a thread in place through the current collection", () => {
    const threadsRef = { current: [createThread()] };
    let latestThreads = threadsRef.current;
    const controller = createThreadStateUpdaters({
      threadsRef,
      setThreads: (value) => {
        latestThreads = value;
      },
    });

    controller.updateThreadStateById("thread-1", (thread) => ({
      ...thread,
      name: "Renamed",
    }));

    expect(latestThreads[0]?.name).toBe("Renamed");
  });

  it("appends messages and operation logs with cloned payloads", () => {
    const threadsRef = { current: [createThread()] };
    let latestThreads = threadsRef.current;
    const controller = createThreadStateUpdaters({
      threadsRef,
      setThreads: (value) => {
        latestThreads = value;
      },
    });

    controller.appendMessageToThreadState("thread-1", {
      id: "msg-1",
      role: "user",
      content: "hello",
      createdAt: "2026-03-10T00:00:00.000Z",
      turnId: "turn-1",
      attachments: [],
      skillActivations: [],
    });
    controller.appendThreadOperationLogToThreadState("thread-1", {
      id: "log-1",
      sequence: 1,
      operationType: "mcp",
      serverName: "saved-server",
      method: "tools/call",
      startedAt: "2026-03-10T00:00:00.000Z",
      completedAt: "2026-03-10T00:00:01.000Z",
      isError: false,
      turnId: "turn-1",
      request: {},
      response: {},
    });

    expect(latestThreads[0]?.messages).toHaveLength(1);
    expect(latestThreads[0]?.mcpRpcLogs).toHaveLength(1);
  });

  it("applies thread environment updates", () => {
    const threadsRef = { current: [createThread()] };
    let latestThreads = threadsRef.current;
    const controller = createThreadStateUpdaters({
      threadsRef,
      setThreads: (value) => {
        latestThreads = value;
      },
    });

    controller.applyThreadEnvironmentToThreadState("thread-1", {
      FOO: "bar",
    });

    expect(latestThreads[0]?.threadEnvironment).toEqual({ FOO: "bar" });
  });
});
