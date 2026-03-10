import { describe, expect, it } from "vitest";
import type { McpHttpServerConfig, McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";
import {
  connectMcpServerToThread,
  reconcileSavedThreadMcpServer,
  removeThreadMcpServerByConfig,
  removeThreadMcpServerById,
  toggleThreadMcpServer,
} from "./thread-mcp-server-operations";

function createHttpServer(
  overrides: Partial<McpHttpServerConfig> & {
    id: string;
    name: string;
    url: string;
  },
): McpHttpServerConfig {
  const {
    id,
    name,
    url,
    ...rest
  } = overrides;
  return {
    id,
    name,
    transport: "streamable_http",
    url,
    headers: {},
    useAzureAuth: false,
    azureAuthScope: "https://cognitiveservices.azure.com/.default",
    timeoutSeconds: 30,
    ...rest,
  };
}

function createThreadState(overrides: Partial<ThreadState> = {}): ThreadState {
  return {
    id: "thread-1",
    name: "Thread 1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "high",
    webSearchEnabled: false,
    agentInstruction: "Instruction",
    instructionContextToggles: {
      system: true,
    },
    threadEnvironment: {},
    messages: [],
    mcpServers: [],
    mcpRpcLogs: [],
    skillSelections: [],
    ...overrides,
  };
}

describe("thread-mcp-server-operations", () => {
  it("connects a new MCP server and renames an existing config match", () => {
    const existingServer = createHttpServer({
      id: "mcp-1",
      name: "Filesystem",
      url: "https://example.test/mcp",
    });
    const renamedMatch = createHttpServer({
      id: "mcp-2",
      name: "Filesystem Renamed",
      url: "https://example.test/mcp",
    });

    expect(
      connectMcpServerToThread(createThreadState(), existingServer).mcpServers,
    ).toEqual([existingServer]);

    expect(
      connectMcpServerToThread(
        createThreadState({
          mcpServers: [existingServer],
        }),
        renamedMatch,
      ).mcpServers,
    ).toEqual([
      {
        ...existingServer,
        name: "Filesystem Renamed",
      },
    ]);
  });

  it("toggles and removes thread MCP servers", () => {
    const first = createHttpServer({
      id: "mcp-1",
      name: "Filesystem",
      url: "https://example.test/mcp",
    });
    const duplicateConfig = createHttpServer({
      id: "mcp-2",
      name: "Filesystem Duplicate",
      url: "https://example.test/mcp",
    });
    const second = createHttpServer({
      id: "mcp-3",
      name: "GitHub",
      url: "https://example.test/github",
    });
    const thread = createThreadState({
      mcpServers: [first, second],
    });

    expect(toggleThreadMcpServer(thread, duplicateConfig).mcpServers).toEqual([
      second,
    ]);
    expect(removeThreadMcpServerById(thread, "mcp-3").mcpServers).toEqual([
      first,
    ]);
    expect(removeThreadMcpServerByConfig(thread, duplicateConfig).mcpServers).toEqual([
      second,
    ]);
  });

  it("reconciles an edited saved profile onto the active thread", () => {
    const previousServer = createHttpServer({
      id: "mcp-1",
      name: "Filesystem",
      url: "https://example.test/mcp",
    });
    const secondServer = createHttpServer({
      id: "mcp-2",
      name: "GitHub",
      url: "https://example.test/github",
    });
    const renamedDuplicate = createHttpServer({
      id: "mcp-3",
      name: "Filesystem Shared",
      url: "https://example.test/github",
    });

    expect(
      reconcileSavedThreadMcpServer(
        createThreadState({
          mcpServers: [previousServer],
        }),
        {
          previousServer,
          savedProfile: secondServer,
        },
      ).mcpServers,
    ).toEqual([secondServer]);

    expect(
      reconcileSavedThreadMcpServer(
        createThreadState({
          mcpServers: [previousServer, secondServer],
        }),
        {
          previousServer,
          savedProfile: renamedDuplicate,
        },
      ).mcpServers,
    ).toEqual([
      {
        ...secondServer,
        name: "Filesystem Shared",
      },
    ]);
  });
});
