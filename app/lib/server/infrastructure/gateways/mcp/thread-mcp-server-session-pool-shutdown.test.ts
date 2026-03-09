/**
 * Test module verifying MCP session-pool shutdown hook registration.
 */
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import {
  registerThreadMcpServerSessionPoolShutdownHooks,
  threadMcpServerSessionPoolShutdownTestUtils,
} from "~/lib/server/mcp/thread-mcp-server-session-pool-shutdown";

afterEach(() => {
  threadMcpServerSessionPoolShutdownTestUtils.resetRegistration();
});

describe("registerThreadMcpServerSessionPoolShutdownHooks", () => {
  it("registers hooks only once", () => {
    const processEmitter = new EventEmitter();
    const processRef = {
      once: (event: "beforeExit" | "SIGINT" | "SIGTERM", listener: () => void) => {
        processEmitter.once(event, listener);
      },
    };

    registerThreadMcpServerSessionPoolShutdownHooks({
      processRef,
      closeAllSessions: async () => {},
    });
    registerThreadMcpServerSessionPoolShutdownHooks({
      processRef,
      closeAllSessions: async () => {},
    });

    expect(processEmitter.listenerCount("beforeExit")).toBe(1);
    expect(processEmitter.listenerCount("SIGINT")).toBe(1);
    expect(processEmitter.listenerCount("SIGTERM")).toBe(1);
  });

  it("invokes session cleanup when shutdown event fires", async () => {
    const processEmitter = new EventEmitter();
    const processRef = {
      once: (event: "beforeExit" | "SIGINT" | "SIGTERM", listener: () => void) => {
        processEmitter.once(event, listener);
      },
    };
    let cleanupCalls = 0;

    registerThreadMcpServerSessionPoolShutdownHooks({
      processRef,
      closeAllSessions: async () => {
        cleanupCalls += 1;
      },
    });

    processEmitter.emit("SIGTERM");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(cleanupCalls).toBe(1);
  });
});
