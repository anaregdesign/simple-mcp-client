import { describe, expect, it, vi } from "vitest";
import {
  clearMcpServerEditState,
  populateMcpServerFormForEdit,
  resetMcpServerFormInputs,
} from "~/lib/client/usecase/workspace/mcp-profiles/form-editing";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";

describe("mcp-profiles/form-editing", () => {
  it("resets the form to defaults when clearing edit state", () => {
    const setMcpTransport = vi.fn();
    const setMcpAzureAuthScopeInput = vi.fn();
    const setMcpTimeoutSecondsInput = vi.fn();
    const options = {
      setMcpNameInput: vi.fn(),
      setMcpTransport,
      setMcpUrlInput: vi.fn(),
      setMcpCommandInput: vi.fn(),
      setMcpArgsInput: vi.fn(),
      setMcpCwdInput: vi.fn(),
      setMcpEnvInput: vi.fn(),
      setMcpHeadersInput: vi.fn(),
      setMcpUseAzureAuthInput: vi.fn(),
      setMcpAzureAuthScopeInput,
      setMcpTimeoutSecondsInput,
      setEditingMcpServerId: vi.fn(),
      setMcpFormError: vi.fn(),
      setMcpFormWarning: vi.fn(),
    };

    clearMcpServerEditState(options);

    expect(options.setEditingMcpServerId).toHaveBeenCalledWith("");
    expect(setMcpTransport).toHaveBeenCalledWith("streamable_http");
    expect(setMcpAzureAuthScopeInput).toHaveBeenCalledWith(
      "https://cognitiveservices.azure.com/.default",
    );
    expect(setMcpTimeoutSecondsInput).toHaveBeenCalledWith("30");
    expect(options.setMcpFormError).toHaveBeenCalledWith(null);
    expect(options.setMcpFormWarning).toHaveBeenCalledWith(null);
  });

  it("populates stdio and http forms from a saved profile", () => {
    const setters = {
      setMcpNameInput: vi.fn(),
      setMcpTransport: vi.fn(),
      setMcpUrlInput: vi.fn(),
      setMcpCommandInput: vi.fn(),
      setMcpArgsInput: vi.fn(),
      setMcpCwdInput: vi.fn(),
      setMcpEnvInput: vi.fn(),
      setMcpHeadersInput: vi.fn(),
      setMcpUseAzureAuthInput: vi.fn(),
      setMcpAzureAuthScopeInput: vi.fn(),
      setMcpTimeoutSecondsInput: vi.fn(),
    };

    const stdioProfile: McpServerConfig = {
      id: "stdio-1",
      name: "stdio",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server"],
      cwd: "/tmp/project",
      env: { FOO: "bar" },
      connectOnThreadCreate: false,
    };
    populateMcpServerFormForEdit(stdioProfile, setters);
    expect(setters.setMcpCommandInput).toHaveBeenLastCalledWith("npx");
    expect(setters.setMcpArgsInput).toHaveBeenLastCalledWith(
      JSON.stringify(["-y", "@modelcontextprotocol/server"]),
    );

    const httpProfile: McpServerConfig = {
      id: "http-1",
      name: "http",
      transport: "streamable_http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer token" },
      useAzureAuth: true,
      azureAuthScope: "scope/.default",
      timeoutSeconds: 30,
      connectOnThreadCreate: false,
    };
    populateMcpServerFormForEdit(httpProfile, setters);
    expect(setters.setMcpUrlInput).toHaveBeenLastCalledWith(
      "https://example.com/mcp",
    );
    expect(setters.setMcpUseAzureAuthInput).toHaveBeenLastCalledWith(true);
    expect(setters.setMcpTimeoutSecondsInput).toHaveBeenLastCalledWith("30");
  });

  it("resets form inputs directly", () => {
    const setters = {
      setMcpNameInput: vi.fn(),
      setMcpTransport: vi.fn(),
      setMcpUrlInput: vi.fn(),
      setMcpCommandInput: vi.fn(),
      setMcpArgsInput: vi.fn(),
      setMcpCwdInput: vi.fn(),
      setMcpEnvInput: vi.fn(),
      setMcpHeadersInput: vi.fn(),
      setMcpUseAzureAuthInput: vi.fn(),
      setMcpAzureAuthScopeInput: vi.fn(),
      setMcpTimeoutSecondsInput: vi.fn(),
    };

    resetMcpServerFormInputs(setters);

    expect(setters.setMcpNameInput).toHaveBeenCalledWith("");
    expect(setters.setMcpTransport).toHaveBeenCalledWith("streamable_http");
  });
});
