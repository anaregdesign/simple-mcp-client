/**
 * Client UI component module.
 */
import { FluentUI } from "~/components/shared/fluent";
import { ConfigSection } from "~/components/shared/ConfigSection";
import { CopyableStatusMessageList } from "~/components/CopyableStatusMessageList";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type {
  AzureConnectionOptionView,
} from "~/lib/client/usecase/workspace/azure-settings/view-types";
import { REASONING_EFFORT_OPTIONS } from "~/lib/constants/chat";
import {
  NO_AVAILABLE_DEPLOYMENTS_OPTION_LABEL,
  NO_AVAILABLE_PROJECTS_OPTION_LABEL,
} from "~/lib/constants/client";

const { Select, Spinner } = FluentUI;

type UtilityModelSectionProps = {
  isAzureAuthRequired: boolean;
  isSending: boolean;
  isLoadingAzureConnections: boolean;
  isLoadingUtilityAzureDeployments: boolean;
  azureConnections: AzureConnectionOptionView[];
  selectedUtilityAzureConnectionId: string;
  selectedUtilityAzureDeploymentName: string;
  utilityAzureDeployments: string[];
  utilityReasoningEffort: ReasoningEffort;
  utilityReasoningEffortOptions: ReasoningEffort[];
  isUtilityReasoningEffortSupported: boolean;
  utilityAzureDeploymentError: string | null;
  onUtilityProjectChange: (projectId: string) => void;
  onUtilityDeploymentChange: (deploymentName: string) => void;
  onUtilityReasoningEffortChange: (value: ReasoningEffort) => void;
};

export function UtilityModelSection(props: UtilityModelSectionProps) {
  const {
    isAzureAuthRequired,
    isSending,
    isLoadingAzureConnections,
    isLoadingUtilityAzureDeployments,
    azureConnections,
    selectedUtilityAzureConnectionId,
    selectedUtilityAzureDeploymentName,
    utilityAzureDeployments,
    utilityReasoningEffort,
    utilityReasoningEffortOptions,
    isUtilityReasoningEffortSupported,
    utilityAzureDeploymentError,
    onUtilityProjectChange,
    onUtilityDeploymentChange,
    onUtilityReasoningEffortChange,
  } = props;

  return (
    <ConfigSection
      className="setting-group-utility-model"
      title="Utility Model 🧰"
      description="Used for instruction enhancement and utility workflows."
    >
      {isAzureAuthRequired ? (
        <p className="field-hint">
          Sign in from Azure Connection to configure Utility Model.
        </p>
      ) : (
        <>
          {isLoadingAzureConnections || isLoadingUtilityAzureDeployments ? (
            <div
              className="azure-loading-notice"
              role="status"
              aria-live="polite"
            >
              <Spinner size="tiny" />
              {isLoadingAzureConnections
                ? "Loading projects from Azure..."
                : "Loading Utility deployment options..."}
            </div>
          ) : null}
          <label className="input-label" htmlFor="utility-model-project">
            Utility Project
          </label>
          <Select
            id="utility-model-project"
            value={selectedUtilityAzureConnectionId}
            onChange={(_, data) => {
              onUtilityProjectChange(data.value);
            }}
            disabled={
              isSending ||
              isLoadingAzureConnections ||
              azureConnections.length === 0
            }
            title="Select the Azure project used by Utility Model."
          >
            {azureConnections.length > 0 ? null : (
              <option value="">{NO_AVAILABLE_PROJECTS_OPTION_LABEL}</option>
            )}
            {azureConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.projectName}
              </option>
            ))}
          </Select>
          <label className="input-label" htmlFor="utility-model-deployment">
            Utility Deployment
          </label>
          <Select
            id="utility-model-deployment"
            value={selectedUtilityAzureDeploymentName}
            onChange={(_, data) => {
              onUtilityDeploymentChange(data.value);
            }}
            disabled={
              isSending ||
              isLoadingAzureConnections ||
              isLoadingUtilityAzureDeployments ||
              !selectedUtilityAzureConnectionId
            }
            title="Select the Azure deployment used by Utility Model."
          >
            {utilityAzureDeployments.length > 0 ? null : (
              <option value="">{NO_AVAILABLE_DEPLOYMENTS_OPTION_LABEL}</option>
            )}
            {utilityAzureDeployments.map((deploymentName) => (
              <option key={deploymentName} value={deploymentName}>
                {deploymentName}
              </option>
            ))}
          </Select>
          <CopyableStatusMessageList
            messages={[
              {
                intent: "error",
                text: utilityAzureDeploymentError,
              },
            ]}
          />
          <label
            className="input-label"
            htmlFor="utility-model-reasoning-effort"
          >
            Utility Reasoning Effort
          </label>
          <Select
            id="utility-model-reasoning-effort"
            value={utilityReasoningEffort}
            onChange={(_, data) => {
              if (
                REASONING_EFFORT_OPTIONS.includes(data.value as ReasoningEffort)
              ) {
                onUtilityReasoningEffortChange(data.value as ReasoningEffort);
              }
            }}
            disabled={
              isSending ||
              isLoadingAzureConnections ||
              !isUtilityReasoningEffortSupported
            }
            title={
              isUtilityReasoningEffortSupported
                ? "Select reasoning effort for Utility Model runs."
                : "This Utility deployment does not support Reasoning Effort."
            }
          >
            {utilityReasoningEffortOptions.map((effort) => (
              <option key={effort} value={effort}>
                {formatReasoningEffortLabel(effort)}
              </option>
            ))}
          </Select>
          {isUtilityReasoningEffortSupported ? null : (
            <p className="field-hint">
              This deployment does not support Reasoning Effort. Value is fixed
              to None and omitted from requests.
            </p>
          )}
        </>
      )}
    </ConfigSection>
  );
}

function formatReasoningEffortLabel(value: ReasoningEffort): string {
  switch (value) {
    case "none":
      return "None";
    case "minimal":
      return "Minimal";
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "xhigh":
      return "XHigh";
    default:
      return value;
  }
}
