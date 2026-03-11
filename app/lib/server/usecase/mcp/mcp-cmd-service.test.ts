import { describe, expect, it, vi } from "vitest";
import {
  type CommandDirectoryScope,
  type McpCmdShellGateway,
  McpCmdService,
} from "~/lib/server/usecase/mcp/mcp-cmd-service";

function createService(options: {
  resolveWorkingDirectory?: (
    userId: number,
    threadId: string | null,
    workingDirectory: string | null,
  ) => { ok: true; value: CommandDirectoryScope } | { ok: false; error: string };
  shellGateway?: McpCmdShellGateway;
} = {}) {
  const resolveWorkingDirectory =
    options.resolveWorkingDirectory ??
    vi.fn(() => ({
      ok: true as const,
      value: {
        threadDirectory: "/tmp/thread-a",
        workingDirectory: "/tmp/thread-a",
      },
    }));
  const shellGateway =
    options.shellGateway ??
    ({
      executeCommand: vi.fn(async () => ({
        ok: true as const,
        value: {
          stdout: "ok\n",
          stderr: "",
          stdoutTruncated: false,
          stderrTruncated: false,
          exitCode: 0,
          signal: null,
          timedOut: false,
          durationMs: 5,
          shell: {
            executable: "/bin/zsh",
            argsPrefix: ["-lc"],
            family: "posix" as const,
            source: "process.env.SHELL",
            platform: "darwin",
          },
        },
      })),
    } satisfies McpCmdShellGateway);

  return {
    service: new McpCmdService({
      resolveWorkingDirectory,
      shellGateway,
    }),
    resolveWorkingDirectory,
    shellGateway,
  };
}

describe("McpCmdService", () => {
  it("rejects non-object tool arguments", async () => {
    const { service } = createService();

    await expect(
      service.executeTool(
        {
          userId: 42,
          threadId: "thread-a",
          turnId: null,
        },
        "echo invalid",
      ),
    ).resolves.toEqual({
      isError: true,
      payload: {
        executed: false,
        error: "Tool arguments must be a JSON object.",
        threadContext: {
          threadId: "thread-a",
          turnId: null,
        },
      },
    });
  });

  it("uses client-provided threadId when resolving the working directory", async () => {
    const { service, resolveWorkingDirectory } = createService();

    const result = await service.executeTool(
      {
        userId: 42,
        threadId: "thread-from-header",
        turnId: "turn-a",
      },
      {
        threadId: "thread-from-client",
        command: "echo from-client",
      },
    );

    expect(result.isError).toBe(false);
    expect(resolveWorkingDirectory).toHaveBeenCalledWith(
      42,
      "thread-from-client",
      null,
    );
    expect(result.payload).toMatchObject({
      executed: true,
      threadContext: {
        threadId: "thread-from-client",
        turnId: "turn-a",
      },
    });
  });

  it("blocks critical destructive commands before invoking the shell gateway", async () => {
    const shellGateway = {
      executeCommand: vi.fn(),
    } satisfies McpCmdShellGateway;
    const { service } = createService({
      shellGateway,
    });

    const result = await service.executeTool(
      {
        userId: 42,
        threadId: "thread-a",
        turnId: null,
      },
      {
        command: "rm -rf /",
      },
    );

    expect(result).toMatchObject({
      isError: true,
      payload: {
        executed: false,
        command: "rm -rf /",
      },
    });
    expect(shellGateway.executeCommand).not.toHaveBeenCalled();
  });

  it("returns a shell execution error payload when the gateway fails", async () => {
    const { service } = createService({
      shellGateway: {
        executeCommand: vi.fn(async () => ({
          ok: false as const,
          error: "Failed to execute command: boom",
          shell: {
            executable: "/bin/zsh",
            argsPrefix: ["-lc"],
            family: "posix" as const,
            source: "fallback",
            platform: "darwin",
          },
        })),
      },
    });

    await expect(
      service.executeTool(
        {
          userId: 42,
          threadId: "thread-a",
          turnId: null,
        },
        {
          command: "echo boom",
        },
      ),
    ).resolves.toEqual({
      isError: true,
      payload: {
        executed: false,
        error: "Failed to execute command: boom",
        command: "echo boom",
        workingDirectory: "/tmp/thread-a",
        timeoutSeconds: 120,
        threadContext: {
          threadId: "thread-a",
          turnId: null,
        },
        shell: {
          executable: "/bin/zsh",
          argsPrefix: ["-lc"],
          family: "posix",
          source: "fallback",
          platform: "darwin",
        },
      },
    });
  });
});
