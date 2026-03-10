import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type {
  McpTransport,
} from "~/lib/client/usecase/workspace/view-types";
import {
  DEFAULT_MCP_TRANSPORT,
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
} from "~/lib/constants/mcp";
import {
  clearMcpServerEditState as clearMcpServerEditStateOperation,
  populateMcpServerFormForEdit as populateMcpServerFormForEditOperation,
  resetMcpServerFormInputs as resetMcpServerFormInputsOperation,
} from "./controller";

export function useMcpProfileForm() {
  const workspaceMcpServerProfilesRef = useRef<McpServerConfig[]>([]);

  const [workspaceMcpServerProfiles, setWorkspaceMcpServerProfiles] = useState<
    McpServerConfig[]
  >([]);
  const [mcpNameInput, setMcpNameInput] = useState("");
  const [mcpUrlInput, setMcpUrlInput] = useState("");
  const [mcpCommandInput, setMcpCommandInput] = useState("");
  const [mcpArgsInput, setMcpArgsInput] = useState("");
  const [mcpCwdInput, setMcpCwdInput] = useState("");
  const [mcpEnvInput, setMcpEnvInput] = useState("");
  const [mcpHeadersInput, setMcpHeadersInput] = useState("");
  const [mcpUseAzureAuthInput, setMcpUseAzureAuthInput] = useState(false);
  const [mcpAzureAuthScopeInput, setMcpAzureAuthScopeInput] = useState(
    MCP_DEFAULT_AZURE_AUTH_SCOPE,
  );
  const [mcpTimeoutSecondsInput, setMcpTimeoutSecondsInput] = useState(
    String(MCP_DEFAULT_TIMEOUT_SECONDS),
  );
  const [mcpTransport, setMcpTransport] = useState<McpTransport>(
    DEFAULT_MCP_TRANSPORT,
  );
  const [editingMcpServerId, setEditingMcpServerId] = useState("");
  const [mcpFormError, setMcpFormError] = useState<string | null>(null);
  const [mcpFormWarning, setMcpFormWarning] = useState<string | null>(null);
  const [workspaceMcpServerProfileError, setWorkspaceMcpServerProfileError] =
    useState<string | null>(null);
  const [
    isLoadingWorkspaceMcpServerProfiles,
    setIsLoadingWorkspaceMcpServerProfiles,
  ] = useState(false);
  const [isSavingMcpServer, setIsSavingMcpServer] = useState(false);
  const [
    isDeletingWorkspaceMcpServerProfile,
    setIsDeletingWorkspaceMcpServerProfile,
  ] = useState(false);

  useEffect(() => {
    workspaceMcpServerProfilesRef.current = workspaceMcpServerProfiles;
  }, [workspaceMcpServerProfiles]);

  function writeWorkspaceMcpServerProfiles(profiles: McpServerConfig[]) {
    workspaceMcpServerProfilesRef.current = profiles;
    setWorkspaceMcpServerProfiles(profiles);
  }

  const resetMcpServerFormInputs = () =>
    resetMcpServerFormInputsOperation({
      setMcpNameInput,
      setMcpTransport,
      setMcpUrlInput,
      setMcpCommandInput,
      setMcpArgsInput,
      setMcpCwdInput,
      setMcpEnvInput,
      setMcpHeadersInput,
      setMcpUseAzureAuthInput,
      setMcpAzureAuthScopeInput,
      setMcpTimeoutSecondsInput,
    });

  const clearMcpServerEditState = () =>
    clearMcpServerEditStateOperation({
      setEditingMcpServerId,
      setMcpFormError,
      setMcpFormWarning,
      setMcpNameInput,
      setMcpTransport,
      setMcpUrlInput,
      setMcpCommandInput,
      setMcpArgsInput,
      setMcpCwdInput,
      setMcpEnvInput,
      setMcpHeadersInput,
      setMcpUseAzureAuthInput,
      setMcpAzureAuthScopeInput,
      setMcpTimeoutSecondsInput,
    });

  const populateMcpServerFormForEdit = (server: McpServerConfig) =>
    populateMcpServerFormForEditOperation(server, {
      setMcpNameInput,
      setMcpTransport,
      setMcpUrlInput,
      setMcpCommandInput,
      setMcpArgsInput,
      setMcpCwdInput,
      setMcpEnvInput,
      setMcpHeadersInput,
      setMcpUseAzureAuthInput,
      setMcpAzureAuthScopeInput,
      setMcpTimeoutSecondsInput,
    });

  useEffect(() => {
    if (!editingMcpServerId) {
      return;
    }

    const targetExists = workspaceMcpServerProfiles.some(
      (server) => server.id === editingMcpServerId,
    );
    if (!targetExists) {
      clearMcpServerEditState();
    }
  }, [editingMcpServerId, workspaceMcpServerProfiles]);

  return {
    workspaceMcpServerProfilesRef,
    workspaceMcpServerProfiles,
    setWorkspaceMcpServerProfiles,
    writeWorkspaceMcpServerProfiles,
    mcpNameInput,
    setMcpNameInput,
    mcpUrlInput,
    setMcpUrlInput,
    mcpCommandInput,
    setMcpCommandInput,
    mcpArgsInput,
    setMcpArgsInput,
    mcpCwdInput,
    setMcpCwdInput,
    mcpEnvInput,
    setMcpEnvInput,
    mcpHeadersInput,
    setMcpHeadersInput,
    mcpUseAzureAuthInput,
    setMcpUseAzureAuthInput,
    mcpAzureAuthScopeInput,
    setMcpAzureAuthScopeInput,
    mcpTimeoutSecondsInput,
    setMcpTimeoutSecondsInput,
    mcpTransport,
    setMcpTransport,
    editingMcpServerId,
    setEditingMcpServerId,
    mcpFormError,
    setMcpFormError,
    mcpFormWarning,
    setMcpFormWarning,
    workspaceMcpServerProfileError,
    setWorkspaceMcpServerProfileError,
    isLoadingWorkspaceMcpServerProfiles,
    setIsLoadingWorkspaceMcpServerProfiles,
    isSavingMcpServer,
    setIsSavingMcpServer,
    isDeletingWorkspaceMcpServerProfile,
    setIsDeletingWorkspaceMcpServerProfile,
    resetMcpServerFormInputs,
    clearMcpServerEditState,
    populateMcpServerFormForEdit,
  };
}
