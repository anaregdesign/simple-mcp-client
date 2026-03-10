import {
  useEffect,
  useReducer,
  useRef,
} from "react";
import {
  clearMcpServerEditState as clearMcpServerEditStateOperation,
  populateMcpServerFormForEdit as populateMcpServerFormForEditOperation,
  resetMcpServerFormInputs as resetMcpServerFormInputsOperation,
} from "./controller";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import {
  createInitialMcpProfileState,
  type McpProfileState,
} from "./state";
import {
  mcpProfileReducer,
} from "./reducer";

export function useMcpProfileForm() {
  const workspaceMcpServerProfilesRef = useRef<McpServerConfig[]>([]);
  const [state, dispatch] = useReducer(
    mcpProfileReducer,
    undefined,
    createInitialMcpProfileState,
  );

  function patchState(
    patch: Partial<
      Omit<McpProfileState, "formState" | "workspaceMcpServerProfiles">
    >,
  ) {
    dispatch({
      type: "state/patched",
      patch,
    });
  }

  function patchFormState(patch: Partial<McpProfileState["formState"]>) {
    dispatch({
      type: "form/patched",
      patch,
    });
  }

  useEffect(() => {
    workspaceMcpServerProfilesRef.current = state.workspaceMcpServerProfiles;
  }, [state.workspaceMcpServerProfiles]);

  function writeWorkspaceMcpServerProfiles(profiles: McpServerConfig[]) {
    workspaceMcpServerProfilesRef.current = profiles;
    dispatch({
      type: "profiles/set",
      profiles,
    });
  }

  const resetMcpServerFormInputs = () =>
    resetMcpServerFormInputsOperation({
      setMcpNameInput: (value) => {
        patchFormState({
          mcpNameInput: value,
        });
      },
      setMcpTransport: (value) => {
        patchFormState({
          mcpTransport: value,
        });
      },
      setMcpUrlInput: (value) => {
        patchFormState({
          mcpUrlInput: value,
        });
      },
      setMcpCommandInput: (value) => {
        patchFormState({
          mcpCommandInput: value,
        });
      },
      setMcpArgsInput: (value) => {
        patchFormState({
          mcpArgsInput: value,
        });
      },
      setMcpCwdInput: (value) => {
        patchFormState({
          mcpCwdInput: value,
        });
      },
      setMcpEnvInput: (value) => {
        patchFormState({
          mcpEnvInput: value,
        });
      },
      setMcpHeadersInput: (value) => {
        patchFormState({
          mcpHeadersInput: value,
        });
      },
      setMcpUseAzureAuthInput: (value) => {
        patchFormState({
          mcpUseAzureAuthInput: value,
        });
      },
      setMcpAzureAuthScopeInput: (value) => {
        patchFormState({
          mcpAzureAuthScopeInput: value,
        });
      },
      setMcpTimeoutSecondsInput: (value) => {
        patchFormState({
          mcpTimeoutSecondsInput: value,
        });
      },
    });

  const clearMcpServerEditState = () =>
    clearMcpServerEditStateOperation({
      setEditingMcpServerId: (value) => {
        patchFormState({
          editingMcpServerId: value,
        });
      },
      setMcpFormError: (value) => {
        patchState({
          mcpFormError: value,
        });
      },
      setMcpFormWarning: (value) => {
        patchState({
          mcpFormWarning: value,
        });
      },
      setMcpNameInput: (value) => {
        patchFormState({
          mcpNameInput: value,
        });
      },
      setMcpTransport: (value) => {
        patchFormState({
          mcpTransport: value,
        });
      },
      setMcpUrlInput: (value) => {
        patchFormState({
          mcpUrlInput: value,
        });
      },
      setMcpCommandInput: (value) => {
        patchFormState({
          mcpCommandInput: value,
        });
      },
      setMcpArgsInput: (value) => {
        patchFormState({
          mcpArgsInput: value,
        });
      },
      setMcpCwdInput: (value) => {
        patchFormState({
          mcpCwdInput: value,
        });
      },
      setMcpEnvInput: (value) => {
        patchFormState({
          mcpEnvInput: value,
        });
      },
      setMcpHeadersInput: (value) => {
        patchFormState({
          mcpHeadersInput: value,
        });
      },
      setMcpUseAzureAuthInput: (value) => {
        patchFormState({
          mcpUseAzureAuthInput: value,
        });
      },
      setMcpAzureAuthScopeInput: (value) => {
        patchFormState({
          mcpAzureAuthScopeInput: value,
        });
      },
      setMcpTimeoutSecondsInput: (value) => {
        patchFormState({
          mcpTimeoutSecondsInput: value,
        });
      },
    });

  const populateMcpServerFormForEdit = (server: McpServerConfig) =>
    populateMcpServerFormForEditOperation(server, {
      setMcpNameInput: (value) => {
        patchFormState({
          mcpNameInput: value,
        });
      },
      setMcpTransport: (value) => {
        patchFormState({
          mcpTransport: value,
        });
      },
      setMcpUrlInput: (value) => {
        patchFormState({
          mcpUrlInput: value,
        });
      },
      setMcpCommandInput: (value) => {
        patchFormState({
          mcpCommandInput: value,
        });
      },
      setMcpArgsInput: (value) => {
        patchFormState({
          mcpArgsInput: value,
        });
      },
      setMcpCwdInput: (value) => {
        patchFormState({
          mcpCwdInput: value,
        });
      },
      setMcpEnvInput: (value) => {
        patchFormState({
          mcpEnvInput: value,
        });
      },
      setMcpHeadersInput: (value) => {
        patchFormState({
          mcpHeadersInput: value,
        });
      },
      setMcpUseAzureAuthInput: (value) => {
        patchFormState({
          mcpUseAzureAuthInput: value,
        });
      },
      setMcpAzureAuthScopeInput: (value) => {
        patchFormState({
          mcpAzureAuthScopeInput: value,
        });
      },
      setMcpTimeoutSecondsInput: (value) => {
        patchFormState({
          mcpTimeoutSecondsInput: value,
        });
      },
    });

  useEffect(() => {
    if (!state.formState.editingMcpServerId) {
      return;
    }

    const targetExists = state.workspaceMcpServerProfiles.some(
      (server) => server.id === state.formState.editingMcpServerId,
    );
    if (!targetExists) {
      clearMcpServerEditState();
    }
  }, [state.formState.editingMcpServerId, state.workspaceMcpServerProfiles]);

  return {
    workspaceMcpServerProfilesRef,
    workspaceMcpServerProfiles: state.workspaceMcpServerProfiles,
    setWorkspaceMcpServerProfiles: (value: McpServerConfig[]) => {
      dispatch({
        type: "profiles/set",
        profiles: value,
      });
    },
    writeWorkspaceMcpServerProfiles,
    mcpNameInput: state.formState.mcpNameInput,
    setMcpNameInput: (value: string) => {
      patchFormState({
        mcpNameInput: value,
      });
    },
    mcpUrlInput: state.formState.mcpUrlInput,
    setMcpUrlInput: (value: string) => {
      patchFormState({
        mcpUrlInput: value,
      });
    },
    mcpCommandInput: state.formState.mcpCommandInput,
    setMcpCommandInput: (value: string) => {
      patchFormState({
        mcpCommandInput: value,
      });
    },
    mcpArgsInput: state.formState.mcpArgsInput,
    setMcpArgsInput: (value: string) => {
      patchFormState({
        mcpArgsInput: value,
      });
    },
    mcpCwdInput: state.formState.mcpCwdInput,
    setMcpCwdInput: (value: string) => {
      patchFormState({
        mcpCwdInput: value,
      });
    },
    mcpEnvInput: state.formState.mcpEnvInput,
    setMcpEnvInput: (value: string) => {
      patchFormState({
        mcpEnvInput: value,
      });
    },
    mcpHeadersInput: state.formState.mcpHeadersInput,
    setMcpHeadersInput: (value: string) => {
      patchFormState({
        mcpHeadersInput: value,
      });
    },
    mcpUseAzureAuthInput: state.formState.mcpUseAzureAuthInput,
    setMcpUseAzureAuthInput: (value: boolean) => {
      patchFormState({
        mcpUseAzureAuthInput: value,
      });
    },
    mcpAzureAuthScopeInput: state.formState.mcpAzureAuthScopeInput,
    setMcpAzureAuthScopeInput: (value: string) => {
      patchFormState({
        mcpAzureAuthScopeInput: value,
      });
    },
    mcpTimeoutSecondsInput: state.formState.mcpTimeoutSecondsInput,
    setMcpTimeoutSecondsInput: (value: string) => {
      patchFormState({
        mcpTimeoutSecondsInput: value,
      });
    },
    mcpTransport: state.formState.mcpTransport,
    setMcpTransport: (value: McpProfileState["formState"]["mcpTransport"]) => {
      patchFormState({
        mcpTransport: value,
      });
    },
    editingMcpServerId: state.formState.editingMcpServerId,
    setEditingMcpServerId: (value: string) => {
      patchFormState({
        editingMcpServerId: value,
      });
    },
    mcpFormError: state.mcpFormError,
    setMcpFormError: (value: string | null) => {
      patchState({
        mcpFormError: value,
      });
    },
    mcpFormWarning: state.mcpFormWarning,
    setMcpFormWarning: (value: string | null) => {
      patchState({
        mcpFormWarning: value,
      });
    },
    workspaceMcpServerProfileError: state.workspaceMcpServerProfileError,
    setWorkspaceMcpServerProfileError: (value: string | null) => {
      patchState({
        workspaceMcpServerProfileError: value,
      });
    },
    isLoadingWorkspaceMcpServerProfiles: state.isLoadingWorkspaceMcpServerProfiles,
    setIsLoadingWorkspaceMcpServerProfiles: (value: boolean) => {
      patchState({
        isLoadingWorkspaceMcpServerProfiles: value,
      });
    },
    isSavingMcpServer: state.isSavingMcpServer,
    setIsSavingMcpServer: (value: boolean) => {
      patchState({
        isSavingMcpServer: value,
      });
    },
    isDeletingWorkspaceMcpServerProfile:
      state.isDeletingWorkspaceMcpServerProfile,
    setIsDeletingWorkspaceMcpServerProfile: (value: boolean) => {
      patchState({
        isDeletingWorkspaceMcpServerProfile: value,
      });
    },
    resetMcpServerFormInputs,
    clearMcpServerEditState,
    populateMcpServerFormForEdit,
  };
}
