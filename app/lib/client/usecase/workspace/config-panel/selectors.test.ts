import { describe, expect, it, vi } from "vitest";
import {
  buildSettingsTabProps,
  buildThreadsTabProps,
} from "~/lib/client/usecase/workspace/config-panel/selectors";
import { THREAD_INSTRUCTION_CONTEXT_OPTIONS } from "~/lib/contracts/threads/instruction-context";

describe("buildSettingsTabProps", () => {
  it("maps utility deployment loading state to utility section props", () => {
    const onThemeChange = vi.fn();
    const onAzureLogin = vi.fn();
    const onAzureTenantChange = vi.fn();
    const onAzureCatalogReload = vi.fn();
    const onAzureLogout = vi.fn();
    const onUtilityProjectChange = vi.fn();
    const onUtilityDeploymentChange = vi.fn();
    const onUtilityReasoningEffortChange = vi.fn();

    const props = buildSettingsTabProps({
      theme: "light",
      onThemeChange,
      isAzureAuthRequired: false,
      isSending: false,
      isStartingAzureLogin: false,
      onAzureLogin,
      azureTenants: [],
      activeAzureTenantId: "",
      isSwitchingAzureTenant: false,
      onAzureTenantChange,
      isLoadingAzureConnections: false,
      isLoadingAzureDeployments: true,
      isReloadingAzureCatalog: false,
      onAzureCatalogReload,
      activeAzureConnection: null,
      activeAzurePrincipal: null,
      selectedPlaygroundAzureDeploymentName: "",
      isStartingAzureLogout: false,
      onAzureLogout,
      azureTenantSwitchError: null,
      azureLogoutError: null,
      azureConnectionError: null,
      azureConnections: [],
      selectedUtilityAzureConnectionId: "",
      selectedUtilityAzureDeploymentName: "",
      utilityAzureDeployments: [],
      utilityReasoningEffort: "low",
      utilityReasoningEffortOptions: ["low"],
      isUtilityReasoningEffortSupported: true,
      utilityAzureDeploymentError: null,
      onUtilityProjectChange,
      onUtilityDeploymentChange,
      onUtilityReasoningEffortChange,
      isLoadingUtilityAzureDeployments: true,
    });

    expect(props.utilityModelSectionProps.isLoadingUtilityAzureDeployments).toBe(
      true,
    );
    expect(props.azureConnectionSectionProps.isLoadingAzureDeployments).toBe(
      true,
    );
  });
});

describe("buildThreadsTabProps", () => {
  it("maps instruction context toggles into view-ready options", () => {
    const props = buildThreadsTabProps({
      agentInstruction: "System",
      instructionContextToggles: {
        [THREAD_INSTRUCTION_CONTEXT_OPTIONS[0]!.key]: true,
      },
      instructionEnhanceComparison: null,
      describeInstructionLanguage: (language) => language,
      isSending: false,
      isThreadReadOnly: false,
      isEnhancingInstruction: false,
      showEnhancingInstructionSpinner: false,
      isSavingInstructionPrompt: false,
      canSaveAgentInstructionPrompt: true,
      canEnhanceAgentInstruction: true,
      canClearAgentInstruction: true,
      loadedInstructionFileName: null,
      instructionFileInputRef: { current: null },
      instructionFileError: null,
      instructionSaveError: null,
      instructionSaveSuccess: null,
      instructionEnhanceError: null,
      instructionEnhanceSuccess: null,
      onClearInstructionSaveSuccess: vi.fn(),
      onClearInstructionEnhanceSuccess: vi.fn(),
      onInstructionContextToggleChange: vi.fn(),
      onAgentInstructionChange: vi.fn(),
      onOpenInstructionFilePicker: vi.fn(),
      onInstructionFileChange: vi.fn(),
      onSaveInstructionPrompt: vi.fn(),
      onEnhanceInstruction: vi.fn(),
      onClearInstruction: vi.fn(),
      onAdoptEnhancedInstruction: vi.fn(),
      onAdoptOriginalInstruction: vi.fn(),
      activeThreadOptions: [],
      archivedThreadOptions: [],
      activeThreadId: "thread-1",
      isLoadingThreads: false,
      isSwitchingThread: false,
      isCreatingThread: false,
      isDeletingThread: false,
      isClearingThread: false,
      isRestoringThread: false,
      threadError: null,
      onActiveThreadChange: vi.fn(),
      onCreateThread: vi.fn(),
      onThreadRename: vi.fn(),
      onThreadCancel: vi.fn(),
      onThreadDelete: vi.fn(),
      onThreadClear: vi.fn(),
      onThreadRestore: vi.fn(),
    });

    expect(
      props.instructionSectionProps.instructionContextToggleOptions,
    ).toHaveLength(THREAD_INSTRUCTION_CONTEXT_OPTIONS.length);
    expect(
      props.instructionSectionProps.instructionContextToggleOptions[0]?.enabled,
    ).toBe(true);
    expect(
      props.instructionSectionProps.instructionContextToggleOptions.map(
        (option) => option.enabled,
      ),
    ).toEqual([true]);
  });
});
