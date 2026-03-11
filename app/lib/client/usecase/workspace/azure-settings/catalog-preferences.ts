import {
  DEFAULT_UTILITY_REASONING_EFFORT,
} from "~/lib/constants/chat";
import {
  azureSelectionApiClient,
} from "~/lib/client/infrastructure/api/azure-selection-api-client";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import {
  readAzureSelectionFromUnknown,
  type AzureProjectOption,
  type AzureSelectionPreference,
} from "./parsers";
import {
  resolveInitialAzureProjectId,
} from "./catalog-state";
import type {
  AzureSelectionSaveInput,
  AzureSettingsHandlerDependencies,
  AzureSettingsState,
} from "./types";

export type AzureProjectSelectionState = {
  nextPlaygroundProjectId: string;
  nextUtilityProjectId: string;
  preferredUtilityReasoningEffort: ReasoningEffort;
};

export async function loadAzureSelectionPreference(
  deps: AzureSettingsHandlerDependencies,
  tenantId: string,
  principalId: string,
): Promise<AzureSelectionPreference | null> {
  const normalizedTenantId = tenantId.trim();
  const normalizedPrincipalId = principalId.trim();
  if (!normalizedTenantId || !normalizedPrincipalId) {
    return null;
  }

  try {
    const payload = await azureSelectionApiClient.loadSelection();
    return readAzureSelectionFromUnknown(
      payload.selection,
      normalizedTenantId,
      normalizedPrincipalId,
    );
  } catch (selectionError) {
    deps.options.logClientError(
      "load_azure_selection_failed",
      selectionError,
      {
        action: "load_azure_selection",
      },
    );
    return null;
  }
}

export async function saveAzureSelectionPreference(
  deps: AzureSettingsHandlerDependencies,
  selection: AzureSelectionSaveInput,
): Promise<void> {
  const currentPreferredSelection = deps.readPreferredAzureSelection();
  const hasIdentityScopedPreferredSelection =
    currentPreferredSelection !== null &&
    currentPreferredSelection.tenantId === selection.tenantId &&
    currentPreferredSelection.principalId === selection.principalId;
  const nextPreferredSelection = hasIdentityScopedPreferredSelection
    ? {
        ...currentPreferredSelection,
        theme: currentPreferredSelection.theme,
        playground: currentPreferredSelection.playground
          ? { ...currentPreferredSelection.playground }
          : null,
        utility: currentPreferredSelection.utility
          ? { ...currentPreferredSelection.utility }
          : null,
      }
    : {
        tenantId: selection.tenantId,
        principalId: selection.principalId,
        theme: deps.readState().theme,
        playground: null,
        utility: null,
      };

  const targetSelection = {
    projectId: selection.projectId,
    deploymentName: selection.deploymentName,
  };
  if (selection.target === "playground") {
    nextPreferredSelection.playground = targetSelection;
  } else {
    nextPreferredSelection.utility = {
      ...targetSelection,
      reasoningEffort: selection.reasoningEffort,
    };
  }
  deps.writePreferredAzureSelection(nextPreferredSelection);
  const persistedThemeMode = hasIdentityScopedPreferredSelection
    ? currentPreferredSelection.theme
    : null;

  try {
    if (selection.target === "utility") {
      await azureSelectionApiClient.saveSelection({
        target: "utility",
        projectId: selection.projectId,
        deploymentName: selection.deploymentName,
        reasoningEffort: selection.reasoningEffort,
        theme: persistedThemeMode,
      });
    } else {
      await azureSelectionApiClient.saveSelection({
        target: "playground",
        projectId: selection.projectId,
        deploymentName: selection.deploymentName,
        theme: persistedThemeMode,
      });
    }
  } catch (selectionSaveError) {
    deps.options.logClientError(
      "save_azure_selection_failed",
      selectionSaveError,
      {
        action: "save_azure_selection",
      },
    );
  }
}

export async function saveThemePreference(
  deps: AzureSettingsHandlerDependencies,
  nextTheme: AzureSettingsState["theme"],
): Promise<void> {
  const tenantId = deps.options.readActiveAzureTenantId().trim();
  const principalId = deps.options.readActiveAzurePrincipalId().trim();
  if (!tenantId || !principalId) {
    return;
  }

  const currentPreferredSelection = deps.readPreferredAzureSelection();
  deps.writePreferredAzureSelection(
    currentPreferredSelection &&
      currentPreferredSelection.tenantId === tenantId &&
      currentPreferredSelection.principalId === principalId
      ? {
          ...currentPreferredSelection,
          theme: nextTheme,
          playground: currentPreferredSelection.playground
            ? { ...currentPreferredSelection.playground }
            : null,
          utility: currentPreferredSelection.utility
            ? { ...currentPreferredSelection.utility }
            : null,
        }
      : {
          tenantId,
          principalId,
          theme: nextTheme,
          playground: null,
          utility: null,
        },
  );

  try {
    await azureSelectionApiClient.saveSelection({
      theme: nextTheme,
    });
  } catch (selectionSaveError) {
    deps.options.logClientError("save_theme_failed", selectionSaveError, {
      action: "save_theme",
    });
  }
}

export function resolveProjectSelection(
  deps: AzureSettingsHandlerDependencies,
  options: {
    projects: AzureProjectOption[];
    preferredSelection: AzureSelectionPreference | null;
  },
): AzureProjectSelectionState {
  const preferredPlaygroundProjectId =
    options.preferredSelection?.playground?.projectId ?? "";
  const preferredUtilityProjectId =
    options.preferredSelection?.utility?.projectId ?? "";
  const preferredUtilityReasoningEffort =
    options.preferredSelection?.utility?.reasoningEffort ??
    DEFAULT_UTILITY_REASONING_EFFORT;
  const knownProjectIds = new Set(
    options.projects.map((connection) => connection.id),
  );
  const defaultProjectId = options.projects[0]?.id ?? "";
  const nextPlaygroundProjectId = resolveInitialAzureProjectId({
    knownProjectIds,
    currentProjectId: deps.options.readSelectedPlaygroundAzureConnectionId(),
    preferredProjectId: preferredPlaygroundProjectId,
    defaultProjectId,
  });
  const nextUtilityProjectId = resolveInitialAzureProjectId({
    knownProjectIds,
    currentProjectId: deps.options.readSelectedUtilityAzureConnectionId(),
    preferredProjectId: preferredUtilityProjectId,
    fallbackProjectId: nextPlaygroundProjectId,
    defaultProjectId,
  });

  return {
    nextPlaygroundProjectId,
    nextUtilityProjectId,
    preferredUtilityReasoningEffort,
  };
}
