/**
 * Test module verifying /mcp/cmd behavior.
 */
import fs from "node:fs";
import nodeOs from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER } from "~/lib/constants/mcp";

const {
  readAzureArmUserContextMock,
  getOrCreateUserByIdentityMock,
  installGlobalServerErrorLoggingMock,
  logServerRouteEventMock,
} = vi.hoisted(() => ({
  readAzureArmUserContextMock: vi.fn(),
  getOrCreateUserByIdentityMock: vi.fn(),
  installGlobalServerErrorLoggingMock: vi.fn(),
  logServerRouteEventMock: vi.fn(),
}));

vi.mock("~/lib/server/auth/azure-user", () => ({
  readAzureArmUserContext: readAzureArmUserContextMock,
}));

vi.mock("~/lib/server/persistence/user", () => ({
  getOrCreateUserByIdentity: getOrCreateUserByIdentityMock,
}));

vi.mock("~/lib/server/observability/runtime-event-log", () => ({
  installGlobalServerErrorLogging: installGlobalServerErrorLoggingMock,
  logServerRouteEvent: logServerRouteEventMock,
}));

import { action, loader, mcpCmdRouteTestUtils } from "./mcp.cmd";

describe("mcp cmd route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    readAzureArmUserContextMock.mockResolvedValue({
      token: "arm-token-1",
      tenantId: "eecca864-7a91-4b48-9327-e19aa5cc3f35",
      principalId: "25f7c3da-6559-4543-9eb0-fd01d3116fad",
      displayName: "Hiroki Mizukami",
      principalName: "hmizukami@MngEnvMCAP321368.onmicrosoft.com",
      principalType: "user",
    });
    getOrCreateUserByIdentityMock.mockResolvedValue({
      id: 42,
      tenantId: "eecca864-7a91-4b48-9327-e19aa5cc3f35",
      principalId: "25f7c3da-6559-4543-9eb0-fd01d3116fad",
    });
    logServerRouteEventMock.mockResolvedValue(undefined);
  });

  it("returns a method error for GET requests", async () => {
    const response = await loader({
      request: new Request("http://localhost/mcp/cmd", {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
        },
      }),
    });

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed. Use POST /mcp/cmd.",
      },
      id: null,
    });
    expect(installGlobalServerErrorLoggingMock).toHaveBeenCalledTimes(1);
    expect(readAzureArmUserContextMock).not.toHaveBeenCalled();
  });

  it("returns authentication error for unauthenticated requests", async () => {
    readAzureArmUserContextMock.mockResolvedValue(null);

    const response = await action({
      request: new Request("http://localhost/mcp/cmd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "tools-1",
          method: "tools/list",
          params: {},
        }),
      }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Authentication required. Click Azure Login in Settings and try again.",
      },
      id: null,
    });
    expect(getOrCreateUserByIdentityMock).not.toHaveBeenCalled();
  });

  it("publishes shell command execution tool through tools/list", async () => {
    const response = await action({
      request: new Request("http://localhost/mcp/cmd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "tools-1",
          method: "tools/list",
          params: {},
        }),
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.error).toBeUndefined();
    expect(Array.isArray(body.result?.tools)).toBe(true);

    const commandTool = body.result.tools.find(
      (entry: { name?: string }) => entry.name === "shell_execute_command",
    );
    expect(commandTool).toBeTruthy();
    expect(typeof commandTool.description).toBe("string");
    expect(commandTool.description).toContain("stdout/stderr");
    expect(commandTool.inputSchema).toEqual(
      expect.objectContaining({
        type: "object",
        required: ["command"],
        properties: expect.objectContaining({
          threadId: expect.objectContaining({
            type: "string",
            minLength: 1,
          }),
          command: expect.objectContaining({
            type: "string",
            minLength: 1,
            maxLength: 32000,
          }),
          workingDirectory: expect.objectContaining({
            type: "string",
            minLength: 1,
          }),
          timeoutSeconds: expect.objectContaining({
            type: "integer",
            minimum: 1,
            maximum: 600,
          }),
        }),
      }),
    );
  });

  it("executes shell command and returns stdout/stderr details", async () => {
    const defaultWorkingDirectoryResult = mcpCmdRouteTestUtils.resolveWorkingDirectory(
      42,
      "thread-2",
      null,
    );
    expect(defaultWorkingDirectoryResult.ok).toBe(true);
    const expectedWorkingDirectory =
      defaultWorkingDirectoryResult.ok ? defaultWorkingDirectoryResult.value.workingDirectory : "";

    const response = await callShellExecuteTool({
      threadId: "thread-2",
      argumentsValue: {
        command: "echo local-playground-cmd-output",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.error).toBeUndefined();

    const payload = body.result?.structuredContent;
    expect(payload.executed).toBe(true);
    expect(payload.command).toBe("echo local-playground-cmd-output");
    expect(payload.workingDirectory).toBe(expectedWorkingDirectory);
    expect(payload.stdout).toContain("local-playground-cmd-output");
    expect(typeof payload.stderr).toBe("string");
    expect(payload.stdoutTruncated).toBe(false);
    expect(payload.stderrTruncated).toBe(false);
    expect(payload.exitCode).toBe(0);
    expect(payload.signal).toBeNull();
    expect(payload.timedOut).toBe(false);
    expect(typeof payload.durationMs).toBe("number");
    expect(payload.durationMs).toBeGreaterThanOrEqual(0);
    expect(payload.threadContext).toEqual({
      threadId: "thread-2",
      turnId: null,
    });

    expect(payload.shell).toMatchObject({
      executable: expect.any(String),
      argsPrefix: expect.any(Array),
      family: expect.any(String),
      source: expect.any(String),
      platform: process.platform,
    });
  });

  it("requires thread context for secure execution", async () => {
    const response = await callShellExecuteTool({
      argumentsValue: {
        command: "echo no-thread",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result?.isError).toBe(true);
    expect(body.result?.structuredContent).toEqual({
      executed: false,
      error: "threadContext.threadId is required for secure command execution.",
      threadContext: {
        threadId: null,
        turnId: null,
      },
    });
  });

  it("allows compound shell commands", async () => {
    const response = await callShellExecuteTool({
      threadId: "thread-secure-operator",
      argumentsValue: {
        command: "echo one && echo two",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result?.isError).toBeUndefined();
    expect(body.error).toBeUndefined();
    const payload = body.result?.structuredContent;
    expect(payload.executed).toBe(true);
    expect(payload.stdout).toContain("one");
    expect(payload.stdout).toContain("two");
  });

  it("blocks critical destructive command patterns", async () => {
    const response = await callShellExecuteTool({
      threadId: "thread-secure-executable",
      argumentsValue: {
        command: "rm -rf /",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result?.isError).toBe(true);
    const payload = body.result?.structuredContent;
    expect(payload.executed).toBe(false);
    expect(payload.error).toContain("critical operation pattern");
  });

  it("blocks sensitive path references", async () => {
    const response = await callShellExecuteTool({
      threadId: "thread-secure-sensitive-path",
      argumentsValue: {
        command: "cat ~/.ssh/id_rsa",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result?.isError).toBe(true);
    const payload = body.result?.structuredContent;
    expect(payload.executed).toBe(false);
    expect(payload.error).toContain("sensitive path pattern");
  });

  it("rejects workingDirectory outside thread directory", async () => {
    const outsideDirectory = fs.mkdtempSync(
      path.join(nodeOs.tmpdir(), "local-playground-mcp-cmd-outside-working-dir-"),
    );
    try {
      const response = await callShellExecuteTool({
        threadId: "thread-secure-working-dir",
        argumentsValue: {
          command: "echo denied",
          workingDirectory: outsideDirectory,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.result?.isError).toBe(true);
      const payload = body.result?.structuredContent;
      expect(payload.executed).toBe(false);
      expect(payload.error).toContain("workingDirectory must be inside thread directory");
    } finally {
      fs.rmSync(outsideDirectory, { recursive: true, force: true });
    }
  });

  it("allows non-critical commands that target paths outside thread directory", async () => {
    const outsideDirectory = fs.mkdtempSync(
      path.join(nodeOs.tmpdir(), "local-playground-mcp-cmd-outside-path-"),
    );
    const outsideFilePath = path.join(outsideDirectory, "allowed.txt");
    try {
      const response = await callShellExecuteTool({
        threadId: "thread-secure-path-argument",
        argumentsValue: {
          command:
            `node -e "require('node:fs').writeFileSync(process.argv[1], 'ok')" ${JSON.stringify(outsideFilePath)}`,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.result?.isError).toBeUndefined();
      const payload = body.result?.structuredContent;
      expect(payload.executed).toBe(true);
      expect(payload.exitCode).toBe(0);
      expect(fs.readFileSync(outsideFilePath, "utf8")).toBe("ok");
    } finally {
      fs.rmSync(outsideDirectory, { recursive: true, force: true });
    }
  });

  it("uses client-provided threadId from tool arguments", async () => {
    const defaultWorkingDirectoryResult = mcpCmdRouteTestUtils.resolveWorkingDirectory(
      42,
      "thread-from-client",
      null,
    );
    expect(defaultWorkingDirectoryResult.ok).toBe(true);
    const expectedWorkingDirectory =
      defaultWorkingDirectoryResult.ok ? defaultWorkingDirectoryResult.value.workingDirectory : "";

    const response = await callShellExecuteTool({
      argumentsValue: {
        threadId: "thread-from-client",
        command: "echo from-client-thread",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    const payload = body.result?.structuredContent;
    expect(payload.executed).toBe(true);
    expect(payload.threadContext).toEqual({
      threadId: "thread-from-client",
      turnId: null,
    });
    expect(payload.workingDirectory).toBe(expectedWorkingDirectory);
    expect(payload.stdout).toContain("from-client-thread");
  });
});

async function callShellExecuteTool(options: {
  threadId?: string;
  argumentsValue: Record<string, unknown>;
}): Promise<Response> {
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  });

  if (typeof options.threadId === "string") {
    headers.set(MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER, options.threadId);
  }

  return await action({
    request: new Request("http://localhost/mcp/cmd", {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "call-1",
        method: "tools/call",
        params: {
          name: "shell_execute_command",
          arguments: options.argumentsValue,
        },
      }),
    }),
  });
}
