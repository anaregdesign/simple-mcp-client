import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import {
  DEFAULT_MCP_TRANSPORT,
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
} from "~/lib/constants/mcp";
import type { McpProfileFormState } from "./form";

export type McpProfileState = {
  workspaceMcpServerProfiles: McpServerConfig[];
  formState: McpProfileFormState;
  mcpFormError: string | null;
  mcpFormWarning: string | null;
  workspaceMcpServerProfileError: string | null;
  isLoadingWorkspaceMcpServerProfiles: boolean;
  isSavingMcpServer: boolean;
  isDeletingWorkspaceMcpServerProfile: boolean;
};

export function createInitialMcpProfileState(): McpProfileState {
  return {
    workspaceMcpServerProfiles: [],
    formState: {
      editingMcpServerId: "",
      mcpNameInput: "",
      mcpTransport: DEFAULT_MCP_TRANSPORT,
      mcpUrlInput: "",
      mcpCommandInput: "",
      mcpArgsInput: "",
      mcpCwdInput: "",
      mcpEnvInput: "",
      mcpHeadersInput: "",
      mcpUseAzureAuthInput: false,
      mcpAzureAuthScopeInput: MCP_DEFAULT_AZURE_AUTH_SCOPE,
      mcpTimeoutSecondsInput: String(MCP_DEFAULT_TIMEOUT_SECONDS),
    },
    mcpFormError: null,
    mcpFormWarning: null,
    workspaceMcpServerProfileError: null,
    isLoadingWorkspaceMcpServerProfiles: false,
    isSavingMcpServer: false,
    isDeletingWorkspaceMcpServerProfile: false,
  };
}
