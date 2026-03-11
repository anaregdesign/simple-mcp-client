import { describe, expect, it } from "vitest";
import type { McpHttpServerConfig } from "~/lib/contracts/mcp/profile";
import {
  connectThreadMcpServer,
  reconcileThreadMcpServerProfile,
  removeThreadMcpServerByConfig,
  removeThreadMcpServerById,
  toggleThreadMcpServer,
} from "./thread-mcp-server-membership";

function createHttpServer(
  overrides: Partial<McpHttpServerConfig> & {
    id: string;
    name: string;
    url: string;
  },
): McpHttpServerConfig {
  const { id, name, url, ...rest } = overrides;
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

describe("thread-mcp-server-membership", () => {
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

    expect(connectThreadMcpServer([], existingServer)).toEqual([existingServer]);
    expect(connectThreadMcpServer([existingServer], renamedMatch)).toEqual([
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

    expect(toggleThreadMcpServer([first, second], duplicateConfig)).toEqual([
      second,
    ]);
    expect(removeThreadMcpServerById([first, second], "mcp-3")).toEqual([first]);
    expect(removeThreadMcpServerByConfig([first, second], duplicateConfig)).toEqual([
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
      reconcileThreadMcpServerProfile([previousServer], {
        previousServer,
        nextServer: secondServer,
      }),
    ).toEqual([secondServer]);

    expect(
      reconcileThreadMcpServerProfile([previousServer, secondServer], {
        previousServer,
        nextServer: renamedDuplicate,
      }),
    ).toEqual([
      {
        ...secondServer,
        name: "Filesystem Shared",
      },
    ]);
  });
});
