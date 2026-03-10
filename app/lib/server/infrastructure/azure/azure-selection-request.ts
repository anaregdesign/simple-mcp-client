import { REASONING_EFFORT_OPTIONS } from "~/lib/constants/chat";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import { readThemeModeFromUnknown } from "~/lib/domain/value-objects/theme-mode";
import type { AzureSelectionPreferenceWriteInput } from "~/lib/server/usecase/azure/azure-selection-service";

export function parseAzureSelectionPreferenceRequest(
  value: unknown,
): AzureSelectionPreferenceWriteInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const target = value.target;
  const projectId =
    typeof value.projectId === "string" ? value.projectId.trim() : "";
  const deploymentName =
    typeof value.deploymentName === "string" ? value.deploymentName.trim() : "";
  const reasoningEffort =
    typeof value.reasoningEffort === "string"
      ? readReasoningEffortFromUnknown(value.reasoningEffort)
      : null;
  const theme = readThemeModeFromUnknown(value.theme);
  const hasSelectionInput =
    value.target !== undefined ||
    value.projectId !== undefined ||
    value.deploymentName !== undefined ||
    value.reasoningEffort !== undefined;

  if (!hasSelectionInput) {
    if (!theme) {
      return null;
    }

    return {
      target: null,
      projectId: "",
      deploymentName: "",
      reasoningEffort: null,
      theme,
    };
  }

  if (
    (target !== "playground" && target !== "utility") ||
    !projectId ||
    !deploymentName ||
    (target === "utility" && !reasoningEffort)
  ) {
    return null;
  }

  return {
    target,
    projectId,
    deploymentName,
    reasoningEffort,
    theme,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readReasoningEffortFromUnknown(
  value: unknown,
): ReasoningEffort | null {
  if (typeof value !== "string") {
    return null;
  }
  if (REASONING_EFFORT_OPTIONS.includes(value as ReasoningEffort)) {
    return value as ReasoningEffort;
  }

  return null;
}
