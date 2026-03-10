/**
 * Test module verifying chat helpers used by the thin /api/chat flow.
 */
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildChatExecutionSuccessLogContext,
} from "~/lib/server/usecase/chat/chat-execution-log-context";
import {
  hasNonPdfAttachments,
} from "~/lib/server/usecase/chat/chat-code-interpreter";
import {
  applyDefaultThreadDirectoryToStdioServers,
  buildMcpServerSessionConfigKey,
} from "~/lib/server/usecase/chat/mcp-server-config-normalization";
import {
  buildMcpConnectSuccessResponse,
} from "~/lib/server/infrastructure/gateways/mcp/mcp-session-logging";
import {
  readWebSearchUserLocationFromRequest,
} from "~/lib/server/infrastructure/gateways/chat/request-metadata";
import {
  resolveThreadDirectoryPath,
} from "~/lib/server/infrastructure/gateways/chat/thread-directory-context";

describe("readWebSearchUserLocationFromRequest", () => {
  it("reads country from the primary Accept-Language locale", () => {
    const request = new Request("http://localhost/api/chat", {
      headers: {
        "accept-language": "ja-JP,ja;q=0.9,en-US;q=0.8",
      },
    });

    expect(readWebSearchUserLocationFromRequest(request)).toEqual({
      type: "approximate",
      country: "JP",
    });
  });

  it("returns null when Accept-Language has no region code", () => {
    const request = new Request("http://localhost/api/chat", {
      headers: {
        "accept-language": "ja,en;q=0.8",
      },
    });

    expect(readWebSearchUserLocationFromRequest(request)).toBeNull();
  });
});

describe("resolveThreadDirectoryPath", () => {
  it("returns thread workspace directory path when threadId is provided", () => {
    expect(
      resolveThreadDirectoryPath({
        userId: 42,
        threadId: "thread-abc",
      }),
    ).toBe(
      path.join(
        os.homedir(),
        ".foundry_local_playground",
        "users",
        "42",
        "threads",
        "thread-abc",
      ),
    );
  });

  it("returns null when threadId is missing", () => {
    expect(
      resolveThreadDirectoryPath({
        userId: 42,
        threadId: null,
      }),
    ).toBeNull();
  });
});

describe("applyDefaultThreadDirectoryToStdioServers", () => {
  it("applies thread workspace directory path only to stdio servers without explicit cwd", () => {
    const defaultPath =
      "/Users/hiroki/.foundry_local_playground/users/1/threads/thread-a";
    const result = applyDefaultThreadDirectoryToStdioServers(
      [
        {
          name: "local-stdio",
          transport: "stdio",
          command: "node",
          args: ["mcp.js"],
          env: {},
        },
        {
          name: "explicit-stdio",
          transport: "stdio",
          command: "node",
          args: ["mcp.js"],
          cwd: "/tmp/explicit",
          env: {},
        },
      ],
      defaultPath,
      "/Users/hiroki/.foundry_local_playground/users/1",
    );

    expect(result).toEqual([
      {
        name: "local-stdio",
        transport: "stdio",
        command: "node",
        args: ["mcp.js"],
        cwd: defaultPath,
        env: {},
      },
      {
        name: "explicit-stdio",
        transport: "stdio",
        command: "node",
        args: ["mcp.js"],
        cwd: "/tmp/explicit",
        env: {},
      },
    ]);
  });
});

describe("attachment tool routing", () => {
  it("treats non-pdf attachments as code-interpreter targets", () => {
    expect(
      hasNonPdfAttachments([
        {
          name: "notes.pdf",
          mimeType: "application/pdf",
          sizeBytes: 9,
          dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
        },
      ]),
    ).toBe(false);

    expect(
      hasNonPdfAttachments([
        {
          name: "sheet.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 5,
          dataUrl: "data:application/octet-stream;base64,YWJjZA==",
        },
      ]),
    ).toBe(true);
  });
});

describe("buildMcpServerSessionConfigKey", () => {
  it("changes when stdio cwd or env changes", () => {
    const first = buildMcpServerSessionConfigKey({
      name: "filesystem-a",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      cwd: "/tmp/project",
      env: { A: "1" },
    });
    const second = buildMcpServerSessionConfigKey({
      name: "filesystem-a",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      cwd: "/tmp/project",
      env: { A: "2" },
    });

    expect(first).not.toBe(second);
  });
});

describe("buildMcpConnectSuccessResponse", () => {
  it("supports connected and reused statuses", () => {
    expect(buildMcpConnectSuccessResponse("req-1", "connected")).toEqual({
      jsonrpc: "2.0",
      id: "req-1",
      result: {
        status: "connected",
      },
    });
    expect(buildMcpConnectSuccessResponse("req-2", "reused")).toEqual({
      jsonrpc: "2.0",
      id: "req-2",
      result: {
        status: "reused",
      },
    });
  });
});

describe("chat execution success log context", () => {
  it("adds MCP runtime metrics to success context", () => {
    const options: Parameters<typeof buildChatExecutionSuccessLogContext>[0] = {
      threadId: "thread-1",
      turnId: "turn-1",
      userId: 1,
      clientUserAgent: "local-playground-test",
      clientPlatform: "darwin",
      azureConfig: {
        tenantId: "tenant-a",
        projectName: "project",
        baseUrl: "https://example.openai.azure.com/openai/v1/",
        apiVersion: "v1",
        deploymentName: "gpt-5.2",
      },
      message: "hello",
      attachments: [],
      history: [],
      reasoningEffort: "none",
      webSearchEnabled: false,
      webSearchUserLocation: null,
      temperature: null,
      agentInstruction: "Be concise.",
      instructionContextToggles: {
        system: true,
      },
      threadEnvironment: {},
      skills: [],
      explicitSkillLocations: [],
      agentConversationId: null,
      mcpServers: [],
    };

    expect(
      buildChatExecutionSuccessLogContext(options, {
        message: "done",
        threadEnvironment: {
          FOO: "bar",
        },
        operationLogCount: 2,
        mcpRuntimeMetrics: {
          mcpConnectedCount: 1,
          mcpReusedCount: 0,
          mcpEphemeralConnectCount: 0,
          mcpConnectDurationMs: 15,
          mcpSetupDurationMs: 20,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        turnId: "turn-1",
        deploymentName: "gpt-5.2",
        responseLength: 4,
        operationLogCount: 2,
        mcpConnectedCount: 1,
        mcpConnectDurationMs: 15,
      }),
    );
  });
});
