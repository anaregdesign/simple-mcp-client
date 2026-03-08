/**
 * Test module verifying chat runtime stage helpers.
 */
import { describe, expect, it, vi } from "vitest";
import {
  buildAgentRunContext,
  cleanupChatRuntime,
  prepareMcpRuntime,
  prepareSkillRuntime,
  type RuntimeMcpLease,
} from "~/lib/server/chat/chat-runtime-stages";

type TestLease = RuntimeMcpLease & {
  id: string;
  release: () => Promise<void>;
};

describe("prepareMcpRuntime", () => {
  it("collects servers and metrics on successful connections", async () => {
    const release = vi.fn(async () => undefined);

    const result = await prepareMcpRuntime<string, { id: string }, TestLease>({
      serverConfigs: ["a", "b"],
      connectServer: async (serverConfig) => {
        if (serverConfig === "a") {
          return {
            lease: {
              id: "lease-a",
              status: "connected",
              isEphemeral: false,
              release,
            } as TestLease,
            server: { id: "server-a" },
            connectDurationMs: 5,
          };
        }

        return {
          lease: {
            id: "lease-b",
            status: "reused",
            isEphemeral: true,
            release,
          } as TestLease,
          server: { id: "server-b" },
          connectDurationMs: 7,
        };
      },
      releaseLease: async (lease) => lease.release(),
    });

    expect(result.servers).toEqual([{ id: "server-a" }, { id: "server-b" }]);
    expect(result.leases).toHaveLength(2);
    expect(result.metrics).toEqual({
      mcpConnectedCount: 1,
      mcpReusedCount: 1,
      mcpEphemeralConnectCount: 1,
      mcpConnectDurationMs: 12,
      mcpSetupDurationMs: expect.any(Number),
    });
    expect(release).not.toHaveBeenCalled();
  });

  it("releases successful leases when at least one connection fails", async () => {
    const releaseA = vi.fn(async () => undefined);

    await expect(
      prepareMcpRuntime<string, { id: string }, TestLease>({
        serverConfigs: ["a", "b"],
        connectServer: async (serverConfig) => {
          if (serverConfig === "a") {
            return {
              lease: {
                id: "lease-a",
                status: "connected",
                isEphemeral: false,
                release: releaseA,
              } satisfies TestLease,
              server: { id: "server-a" },
              connectDurationMs: 3,
            };
          }

          throw new Error("connect failed");
        },
        releaseLease: async (lease) => lease.release(),
      }),
    ).rejects.toThrow("connect failed");

    expect(releaseA).toHaveBeenCalledTimes(1);
  });
});

describe("prepareSkillRuntime", () => {
  it("creates execution context, emits activation logs, and returns warnings", async () => {
    const emitActivationLogs = vi.fn();

    const result = await prepareSkillRuntime({
      loadRuntime: async () => ({ activeSkills: ["skill-a"] }),
      createExecutionContext: () => ({ env: { A: "1" } }),
      emitActivationLogs,
      collectWarnings: () => ["warn-a"],
    });

    expect(emitActivationLogs).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      runtime: { activeSkills: ["skill-a"] },
      executionContext: { env: { A: "1" } },
      warnings: ["warn-a"],
    });
  });
});

describe("buildAgentRunContext", () => {
  it("keeps only current input when compaction session exists", () => {
    const result = buildAgentRunContext({
      historyInput: ["h1", "h2"],
      currentInput: "current",
      compactionSession: {},
    });

    expect(result.runInput).toEqual(["current"]);
  });

  it("concatenates history and current input when compaction session is absent", () => {
    const result = buildAgentRunContext({
      historyInput: ["h1", "h2"],
      currentInput: "current",
      compactionSession: null,
    });

    expect(result.runInput).toEqual(["h1", "h2", "current"]);
  });
});

describe("cleanupChatRuntime", () => {
  it("runs container cleanup and lease release as best-effort", async () => {
    const deleteCodeInterpreterContainer = vi.fn(async () => {
      throw new Error("container delete failed");
    });
    const releaseA = vi.fn(async () => undefined);
    const releaseB = vi.fn(async () => {
      throw new Error("lease release failed");
    });

    await expect(
      cleanupChatRuntime({
        codeInterpreterContainerId: "container-a",
        deleteCodeInterpreterContainer,
        mcpServerLeases: [
          { release: releaseA },
          { release: releaseB },
        ],
        awaitWithTimeout: async (promise) => promise,
        cleanupTimeoutMs: 500,
      }),
    ).resolves.toBeUndefined();

    expect(deleteCodeInterpreterContainer).toHaveBeenCalledWith("container-a");
    expect(releaseA).toHaveBeenCalledTimes(1);
    expect(releaseB).toHaveBeenCalledTimes(1);
  });
});
