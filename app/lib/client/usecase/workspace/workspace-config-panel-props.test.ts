import { describe, expect, it, vi } from "vitest";
import { MCP_DEFAULT_AZURE_AUTH_SCOPE } from "~/lib/constants/mcp";
import {
  buildWorkspaceMcpServersTabProps,
} from "~/lib/client/usecase/workspace/workspace-config-panel-props";

function createMcpOptions() {
  return {
    workspaceMcpServerProfileOptions: [],
    selectedWorkspaceMcpServerProfileCount: 0,
    isSending: false,
    isActiveThreadArchived: false,
    isLoadingWorkspaceMcpServerProfiles: false,
    isMutatingWorkspaceMcpServerProfiles: false,
    workspaceMcpServerProfileError: null,
    handleToggleWorkspaceMcpServerProfile: vi.fn(),
    handleEditWorkspaceMcpServerProfile: vi.fn(),
    handleDeleteWorkspaceMcpServerProfile: vi.fn().mockResolvedValue(undefined),
    handleReloadWorkspaceMcpServerProfiles: vi.fn(),
    isEditingMcpServer: false,
    editingMcpServerName: null,
    mcpNameInput: "",
    setMcpNameInput: vi.fn(),
    mcpTransport: "stdio" as const,
    setMcpTransport: vi.fn(),
    setMcpFormError: vi.fn(),
    mcpCommandInput: "",
    setMcpCommandInput: vi.fn(),
    mcpArgsInput: "",
    setMcpArgsInput: vi.fn(),
    mcpCwdInput: "",
    setMcpCwdInput: vi.fn(),
    mcpEnvInput: "",
    setMcpEnvInput: vi.fn(),
    mcpUrlInput: "",
    setMcpUrlInput: vi.fn(),
    mcpHeadersInput: "",
    setMcpHeadersInput: vi.fn(),
    mcpUseAzureAuthInput: false,
    setMcpUseAzureAuthInput: vi.fn(),
    mcpAzureAuthScopeInput: "",
    setMcpAzureAuthScopeInput: vi.fn(),
    mcpTimeoutSecondsInput: "60",
    setMcpTimeoutSecondsInput: vi.fn(),
    handleAddMcpServer: vi.fn(),
    handleCancelMcpServerEdit: vi.fn(),
    isSavingMcpServer: false,
    mcpFormError: "Invalid transport",
    mcpFormWarning: "Warning",
    setMcpFormWarning: vi.fn(),
  };
}

describe("buildWorkspaceMcpServersTabProps", () => {
  it("resets the MCP form error when the transport changes", () => {
    const options = createMcpOptions();
    const props = buildWorkspaceMcpServersTabProps(options);

    props.onMcpTransportChange("streamable_http");

    expect(options.setMcpTransport).toHaveBeenCalledWith("streamable_http");
    expect(options.setMcpFormError).toHaveBeenCalledWith(null);
  });

  it("seeds the default Azure auth scope when enabling Azure auth", () => {
    const options = createMcpOptions();
    const props = buildWorkspaceMcpServersTabProps(options);

    props.onMcpUseAzureAuthInputChange(true);

    expect(options.setMcpUseAzureAuthInput).toHaveBeenCalledWith(true);
    expect(options.setMcpAzureAuthScopeInput).toHaveBeenCalledWith(
      MCP_DEFAULT_AZURE_AUTH_SCOPE,
    );
  });
});
