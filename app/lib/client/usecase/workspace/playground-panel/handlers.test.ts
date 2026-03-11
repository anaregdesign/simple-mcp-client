import { describe, expect, it, vi } from "vitest";
import {
  createPlaygroundControlHandlers,
} from "~/lib/client/usecase/workspace/playground-panel/handlers";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

function createDeps() {
  return {
    isSending: false,
    isStartingAzureLogin: false,
    isSwitchingAzureTenant: false,
    isStartingAzureLogout: false,
    isLoadingAzureConnections: false,
    isLoadingPlaygroundAzureDeployments: false,
    isAzureAuthRequired: false,
    azureConnectionError: null,
    hasAzureConnections: true,
    hasActivePlaygroundAzureConnection: true,
    hasPlaygroundAzureDeployments: true,
    hasSelectedPlaygroundAzureDeploymentName: true,
    isPlaygroundReasoningEffortSupported: true,
    selectedPlaygroundDeploymentCompatibleReasoningEffortOptions: [
      "minimal",
      "low",
      "medium",
      "high",
    ] as const,
    effectivePlaygroundReasoningEffortOptions: [
      "minimal",
      "low",
      "medium",
      "high",
    ] as const,
    reasoningEffort: "medium" as ReasoningEffort,
    setUiError: vi.fn(),
    setSystemNotice: vi.fn(),
    setActiveMainTab: vi.fn(),
    setReasoningEffort: vi.fn(),
    setWebSearchEnabled: vi.fn(),
    clearAzureSessionStatus: vi.fn(),
    markAzureAuthRequired: vi.fn(),
    handleAzureLogin: vi.fn().mockResolvedValue(undefined),
    handleSelectPlaygroundProject: vi.fn(),
    handleSelectPlaygroundDeployment: vi.fn(),
    loadAzureProjects: vi.fn().mockResolvedValue(undefined),
  };
}

describe("createPlaygroundControlHandlers", () => {
  it("routes auth-required selector actions to Settings and login", () => {
    const deps = createDeps();
    deps.isAzureAuthRequired = true;

    const handlers = createPlaygroundControlHandlers(deps);
    handlers.handleChatAzureSelectorAction("project");

    expect(deps.clearAzureSessionStatus).toHaveBeenCalledTimes(1);
    expect(deps.markAzureAuthRequired).toHaveBeenCalledTimes(1);
    expect(deps.setActiveMainTab).toHaveBeenCalledWith("settings");
    expect(deps.handleAzureLogin).toHaveBeenCalledTimes(1);
    expect(deps.loadAzureProjects).not.toHaveBeenCalled();
  });

  it("blocks enabling Web Search when the current Reasoning Effort is incompatible", () => {
    const deps = createDeps();
    deps.reasoningEffort = "minimal";

    const handlers = createPlaygroundControlHandlers(deps);
    handlers.handleWebSearchEnabledChange(true);

    expect(deps.setWebSearchEnabled).not.toHaveBeenCalled();
    expect(deps.setUiError).toHaveBeenCalledWith(
      "Selected Reasoning Effort cannot be used with Web Search. Choose a compatible value first.",
    );
  });

  it("clears UI errors after selecting a Playground project", () => {
    const deps = createDeps();
    const handlers = createPlaygroundControlHandlers(deps);

    handlers.handleChatProjectChange("project-1");

    expect(deps.handleSelectPlaygroundProject).toHaveBeenCalledWith("project-1");
    expect(deps.setUiError).toHaveBeenCalledWith(null);
  });
});
