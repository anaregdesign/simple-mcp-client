import { useMemo, useRef } from "react";
import {
  createMcpProfileHandlers,
} from "~/lib/client/usecase/workspace/mcp-profiles/handlers";
import {
  selectWorkspaceMcpProfileViewModel,
} from "~/lib/client/usecase/workspace/mcp-profiles/selectors";
import {
  createWorkspaceMcpProfileStorageRuntime,
} from "~/lib/client/usecase/workspace/mcp-profiles/storage-runtime";
import {
  useMcpProfileForm,
} from "~/lib/client/usecase/workspace/mcp-profiles/use-mcp-profile-form";

type UseWorkspaceMcpProfilesOptions = Omit<
  Parameters<typeof createMcpProfileHandlers>[0],
  | "readWorkspaceMcpServerProfiles"
  | "readEditingMcpServerId"
  | "isDeletingWorkspaceMcpServerProfile"
  | "setWorkspaceMcpServerProfileError"
  | "loadWorkspaceMcpServerProfiles"
  | "clearMcpServerEditState"
  | "setEditingMcpServerId"
  | "populateMcpServerFormForEdit"
  | "setMcpFormError"
  | "setMcpFormWarning"
  | "setIsDeletingWorkspaceMcpServerProfile"
  | "setIsSavingMcpServer"
  | "applyWorkspaceMcpServerProfiles"
  | "deleteWorkspaceMcpServerProfileFromConfig"
  | "saveMcpServerToConfig"
  | "resetMcpServerFormInputs"
  | "mcpFormState"
> & {
  readActiveWorkspaceUserKey: () => string;
  markAzureAuthRequired: () => void;
};

export function useWorkspaceMcpProfiles(
  options: UseWorkspaceMcpProfilesOptions,
) {
  const form = useMcpProfileForm();
  const workspaceMcpServerProfileRequestSeqRef = useRef(0);

  const storageRuntime = createWorkspaceMcpProfileStorageRuntime({
    readActiveWorkspaceUserKey: options.readActiveWorkspaceUserKey,
    nextWorkspaceMcpServerProfileRequestSeq: () => {
      const requestSeq = workspaceMcpServerProfileRequestSeqRef.current + 1;
      workspaceMcpServerProfileRequestSeqRef.current = requestSeq;
      return requestSeq;
    },
    readWorkspaceMcpServerProfileRequestSeq: () =>
      workspaceMcpServerProfileRequestSeqRef.current,
    readWorkspaceMcpServerProfiles: form.readWorkspaceMcpServerProfiles,
    writeWorkspaceMcpServerProfiles: form.writeWorkspaceMcpServerProfiles,
    setWorkspaceMcpServerProfileError: form.setWorkspaceMcpServerProfileError,
    setIsLoadingWorkspaceMcpServerProfiles:
      form.setIsLoadingWorkspaceMcpServerProfiles,
    setEditingMcpServerId: form.setEditingMcpServerId,
    setIsDeletingWorkspaceMcpServerProfile:
      form.setIsDeletingWorkspaceMcpServerProfile,
    markAzureAuthRequired: options.markAzureAuthRequired,
    logClientError: options.logClientError,
  });

  const viewModel = useMemo(
    () =>
      selectWorkspaceMcpProfileViewModel({
        workspaceMcpServerProfiles: form.workspaceMcpServerProfiles,
        activeMcpServers: options.readActiveThreadMcpServers(),
        editingMcpServerId: form.editingMcpServerId,
        isSavingMcpServer: form.isSavingMcpServer,
        isDeletingWorkspaceMcpServerProfile:
          form.isDeletingWorkspaceMcpServerProfile,
      }),
    [
      form.editingMcpServerId,
      form.isDeletingWorkspaceMcpServerProfile,
      form.isSavingMcpServer,
      form.workspaceMcpServerProfiles,
      options,
    ],
  );

  const handlers = createMcpProfileHandlers({
    ...options,
    readWorkspaceMcpServerProfiles: form.readWorkspaceMcpServerProfiles,
    readEditingMcpServerId: () => form.editingMcpServerId,
    isDeletingWorkspaceMcpServerProfile:
      form.isDeletingWorkspaceMcpServerProfile,
    setWorkspaceMcpServerProfileError: form.setWorkspaceMcpServerProfileError,
    loadWorkspaceMcpServerProfiles:
      storageRuntime.loadWorkspaceMcpServerProfiles,
    clearMcpServerEditState: form.clearMcpServerEditState,
    setEditingMcpServerId: form.setEditingMcpServerId,
    populateMcpServerFormForEdit: form.populateMcpServerFormForEdit,
    setMcpFormError: form.setMcpFormError,
    setMcpFormWarning: form.setMcpFormWarning,
    setIsDeletingWorkspaceMcpServerProfile:
      form.setIsDeletingWorkspaceMcpServerProfile,
    setIsSavingMcpServer: form.setIsSavingMcpServer,
    applyWorkspaceMcpServerProfiles:
      storageRuntime.applyWorkspaceMcpServerProfiles,
    deleteWorkspaceMcpServerProfileFromConfig:
      storageRuntime.deleteWorkspaceMcpServerProfileFromConfig,
    saveMcpServerToConfig: storageRuntime.saveMcpServerToConfig,
    resetMcpServerFormInputs: form.resetMcpServerFormInputs,
    mcpFormState: {
      editingMcpServerId: form.editingMcpServerId,
      mcpNameInput: form.mcpNameInput,
      mcpTransport: form.mcpTransport,
      mcpUrlInput: form.mcpUrlInput,
      mcpCommandInput: form.mcpCommandInput,
      mcpArgsInput: form.mcpArgsInput,
      mcpCwdInput: form.mcpCwdInput,
      mcpEnvInput: form.mcpEnvInput,
      mcpHeadersInput: form.mcpHeadersInput,
      mcpUseAzureAuthInput: form.mcpUseAzureAuthInput,
      mcpAzureAuthScopeInput: form.mcpAzureAuthScopeInput,
      mcpTimeoutSecondsInput: form.mcpTimeoutSecondsInput,
    },
  });

  return {
    workspaceMcpServerProfiles: form.workspaceMcpServerProfiles,
    readWorkspaceMcpServerProfiles: form.readWorkspaceMcpServerProfiles,
    clearWorkspaceMcpServerProfilesState:
      storageRuntime.clearWorkspaceMcpServerProfilesState,
    loadWorkspaceMcpServerProfiles:
      storageRuntime.loadWorkspaceMcpServerProfiles,
    workspaceMcpServerProfileOptions:
      viewModel.workspaceMcpServerProfileOptions,
    selectedWorkspaceMcpServerProfileCount:
      viewModel.selectedWorkspaceMcpServerProfileCount,
    isEditingMcpServer: viewModel.isEditingMcpServer,
    editingMcpServerName: viewModel.editingMcpServerName,
    isMutatingWorkspaceMcpServerProfiles:
      viewModel.isMutatingWorkspaceMcpServerProfiles,
    mcpNameInput: form.mcpNameInput,
    setMcpNameInput: form.setMcpNameInput,
    mcpUrlInput: form.mcpUrlInput,
    setMcpUrlInput: form.setMcpUrlInput,
    mcpCommandInput: form.mcpCommandInput,
    setMcpCommandInput: form.setMcpCommandInput,
    mcpArgsInput: form.mcpArgsInput,
    setMcpArgsInput: form.setMcpArgsInput,
    mcpCwdInput: form.mcpCwdInput,
    setMcpCwdInput: form.setMcpCwdInput,
    mcpEnvInput: form.mcpEnvInput,
    setMcpEnvInput: form.setMcpEnvInput,
    mcpHeadersInput: form.mcpHeadersInput,
    setMcpHeadersInput: form.setMcpHeadersInput,
    mcpUseAzureAuthInput: form.mcpUseAzureAuthInput,
    setMcpUseAzureAuthInput: form.setMcpUseAzureAuthInput,
    mcpAzureAuthScopeInput: form.mcpAzureAuthScopeInput,
    setMcpAzureAuthScopeInput: form.setMcpAzureAuthScopeInput,
    mcpTimeoutSecondsInput: form.mcpTimeoutSecondsInput,
    setMcpTimeoutSecondsInput: form.setMcpTimeoutSecondsInput,
    mcpTransport: form.mcpTransport,
    setMcpTransport: form.setMcpTransport,
    mcpFormError: form.mcpFormError,
    setMcpFormError: form.setMcpFormError,
    mcpFormWarning: form.mcpFormWarning,
    setMcpFormWarning: form.setMcpFormWarning,
    workspaceMcpServerProfileError: form.workspaceMcpServerProfileError,
    isLoadingWorkspaceMcpServerProfiles:
      form.isLoadingWorkspaceMcpServerProfiles,
    isSavingMcpServer: form.isSavingMcpServer,
    ...handlers,
  };
}
