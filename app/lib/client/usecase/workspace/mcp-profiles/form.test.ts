import { describe, expect, it } from "vitest";
import { buildMcpServerFromProfileForm } from "./form";

describe("mcp-profile-form", () => {
  it("builds a stdio MCP server from form input", () => {
    const result = buildMcpServerFromProfileForm({
      serverId: "mcp-1",
      formState: {
        editingMcpServerId: "",
        mcpNameInput: "",
        mcpTransport: "stdio",
        mcpUrlInput: "",
        mcpCommandInput: "npx",
        mcpArgsInput: "tool-a --flag value",
        mcpCwdInput: " /workspace ",
        mcpEnvInput: "FOO=bar",
        mcpHeadersInput: "",
        mcpUseAzureAuthInput: false,
        mcpAzureAuthScopeInput: "",
        mcpTimeoutSecondsInput: "30",
      },
    });

    expect(result).toEqual({
      ok: true,
      server: {
        id: "mcp-1",
        name: "npx",
        transport: "stdio",
        command: "npx",
        args: ["tool-a", "--flag", "value"],
        cwd: "/workspace",
        env: {
          FOO: "bar",
        },
      },
    });
  });

  it("returns validation errors for invalid stdio commands", () => {
    expect(
      buildMcpServerFromProfileForm({
        serverId: "mcp-1",
        formState: {
          editingMcpServerId: "",
          mcpNameInput: "",
          mcpTransport: "stdio",
          mcpUrlInput: "",
          mcpCommandInput: "npm exec",
          mcpArgsInput: "",
          mcpCwdInput: "",
          mcpEnvInput: "",
          mcpHeadersInput: "",
          mcpUseAzureAuthInput: false,
          mcpAzureAuthScopeInput: "",
          mcpTimeoutSecondsInput: "30",
        },
      }),
    ).toEqual({
      ok: false,
      error: "MCP stdio command must not include spaces.",
    });
  });

  it("builds an HTTP MCP server with normalized URL and Azure auth scope", () => {
    const result = buildMcpServerFromProfileForm({
      serverId: "mcp-2",
      formState: {
        editingMcpServerId: "",
        mcpNameInput: "Files",
        mcpTransport: "streamable_http",
        mcpUrlInput: "https://example.test/mcp",
        mcpCommandInput: "",
        mcpArgsInput: "",
        mcpCwdInput: "",
        mcpEnvInput: "",
        mcpHeadersInput: "x-api-key=secret",
        mcpUseAzureAuthInput: true,
        mcpAzureAuthScopeInput: "https://management.azure.com/.default",
        mcpTimeoutSecondsInput: "45",
      },
    });

    expect(result).toEqual({
      ok: true,
      server: {
        id: "mcp-2",
        name: "Files",
        transport: "streamable_http",
        url: "https://example.test/mcp",
        headers: {
          "x-api-key": "secret",
        },
        useAzureAuth: true,
        azureAuthScope: "https://management.azure.com/.default",
        timeoutSeconds: 45,
      },
    });
  });

  it("returns validation errors for invalid HTTP URLs", () => {
    expect(
      buildMcpServerFromProfileForm({
        serverId: "mcp-2",
        formState: {
          editingMcpServerId: "",
          mcpNameInput: "",
          mcpTransport: "sse",
          mcpUrlInput: "ftp://example.test/mcp",
          mcpCommandInput: "",
          mcpArgsInput: "",
          mcpCwdInput: "",
          mcpEnvInput: "",
          mcpHeadersInput: "",
          mcpUseAzureAuthInput: false,
          mcpAzureAuthScopeInput: "",
          mcpTimeoutSecondsInput: "30",
        },
      }),
    ).toEqual({
      ok: false,
      error: "MCP server URL must start with http:// or https://.",
    });
  });
});
