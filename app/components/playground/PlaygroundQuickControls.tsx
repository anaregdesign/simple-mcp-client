import { PlaygroundAzureActionSelect } from "~/components/playground/PlaygroundAzureActionSelect";
import { PlaygroundControlTooltip } from "~/components/playground/PlaygroundControlTooltip";
import { QuickControlFrame } from "~/components/shared/QuickControlFrame";
import { FluentUI } from "~/components/shared/fluent";
import type {
  AzureConnectionOptionView,
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";
import {
  NO_AVAILABLE_DEPLOYMENTS_OPTION_LABEL,
  NO_AVAILABLE_PROJECTS_OPTION_LABEL,
} from "~/lib/constants/client";

const { Button, Select, Spinner, Switch } = FluentUI;

type PlaygroundQuickControlsProps = {
  isSending: boolean;
  isChatLocked: boolean;
  isThreadReadOnly: boolean;
  onOpenMessageAttachmentPicker: () => void;
  maxMessageAttachmentFiles: number;
  messageAttachmentFormatHint: string;
  isLoadingAzureConnections: boolean;
  isLoadingAzureDeployments: boolean;
  isAzureAuthRequired: boolean;
  isStartingAzureLogin: boolean;
  isStartingAzureLogout: boolean;
  onChatAzureSelectorAction: (target: "project" | "deployment") => void;
  azureConnections: AzureConnectionOptionView[];
  activeAzureConnectionId: string;
  onProjectChange: (projectId: string) => void;
  selectedAzureDeploymentName: string;
  azureDeployments: string[];
  onDeploymentChange: (deploymentName: string) => void;
  reasoningEffort: ReasoningEffort;
  reasoningEffortOptions: ReasoningEffort[];
  isReasoningEffortSupported: boolean;
  onReasoningEffortChange: (value: ReasoningEffort) => void;
  webSearchEnabled: boolean;
  onWebSearchEnabledChange: (value: boolean) => void;
  canSendMessage: boolean;
  onCancelThreadProcessing: () => void;
};

export function PlaygroundQuickControls({
  isSending,
  isChatLocked,
  isThreadReadOnly,
  onOpenMessageAttachmentPicker,
  maxMessageAttachmentFiles,
  messageAttachmentFormatHint,
  isLoadingAzureConnections,
  isLoadingAzureDeployments,
  isAzureAuthRequired,
  isStartingAzureLogin,
  isStartingAzureLogout,
  onChatAzureSelectorAction,
  azureConnections,
  activeAzureConnectionId,
  onProjectChange,
  selectedAzureDeploymentName,
  azureDeployments,
  onDeploymentChange,
  reasoningEffort,
  reasoningEffortOptions,
  isReasoningEffortSupported,
  onReasoningEffortChange,
  webSearchEnabled,
  onWebSearchEnabledChange,
  canSendMessage,
  onCancelThreadProcessing,
}: PlaygroundQuickControlsProps) {
  const isAzureActionDisabled =
    isSending || isStartingAzureLogin || isStartingAzureLogout;

  const projectControl = isLoadingAzureConnections ? (
    <span
      className="chat-control-loader chat-control-loader-project"
      role="status"
      aria-live="polite"
    >
      <Spinner size="tiny" />
      Loading projects...
    </span>
  ) : isAzureAuthRequired ? (
    <PlaygroundAzureActionSelect
      target="project"
      label="Project"
      text="Project"
      title="Click to sign in with Azure and load projects."
      disabled={isAzureActionDisabled}
      onAction={onChatAzureSelectorAction}
    />
  ) : azureConnections.length === 0 ? (
    <PlaygroundAzureActionSelect
      target="project"
      label="Project"
      text={NO_AVAILABLE_PROJECTS_OPTION_LABEL}
      title="No available projects in the selected tenant. Click to reload Azure projects."
      disabled={isAzureActionDisabled}
      onAction={onChatAzureSelectorAction}
    />
  ) : (
    <Select
      id="chat-azure-project"
      aria-label="Project"
      title="Azure project used for this chat."
      value={activeAzureConnectionId}
      onChange={(event) => {
        onProjectChange(event.target.value);
      }}
      disabled={isSending}
    >
      <optgroup label="Project name">
        {azureConnections.map((connection) => (
          <option key={connection.id} value={connection.id}>
            {connection.projectName}
          </option>
        ))}
      </optgroup>
    </Select>
  );

  const deploymentControl =
    isLoadingAzureConnections || isLoadingAzureDeployments ? (
      <span
        className="chat-control-loader chat-control-loader-deployment"
        role="status"
        aria-live="polite"
      >
        <Spinner size="tiny" />
        Loading deployments...
      </span>
    ) : isAzureAuthRequired || !activeAzureConnectionId ? (
      <PlaygroundAzureActionSelect
        target="deployment"
        label="Deployment"
        text={
          isAzureAuthRequired
            ? "Deployment"
            : azureConnections.length === 0
              ? NO_AVAILABLE_DEPLOYMENTS_OPTION_LABEL
              : "Reload deployments"
        }
        title={
          isAzureAuthRequired
            ? "Click to sign in with Azure and load deployments."
            : azureConnections.length === 0
              ? "No available deployments in the selected tenant. Click to reload Azure projects."
              : "Click to reload deployments for the selected project."
        }
        disabled={isAzureActionDisabled}
        onAction={onChatAzureSelectorAction}
      />
    ) : azureDeployments.length === 0 ? (
      <PlaygroundAzureActionSelect
        target="deployment"
        label="Deployment"
        text={NO_AVAILABLE_DEPLOYMENTS_OPTION_LABEL}
        title="No available deployments in the selected tenant. Click to reload deployments for the selected project."
        disabled={isAzureActionDisabled}
        onAction={onChatAzureSelectorAction}
      />
    ) : (
      <Select
        id="chat-azure-deployment"
        aria-label="Deployment"
        title="Azure deployment used to run the model."
        value={selectedAzureDeploymentName}
        onChange={(event) => {
          onDeploymentChange(event.target.value);
        }}
        disabled={isSending}
      >
        <optgroup label="Deployment name">
          {azureDeployments.map((deployment) => (
            <option key={deployment} value={deployment}>
              {deployment}
            </option>
          ))}
        </optgroup>
      </Select>
    );

  return (
    <div className="chat-composer-actions">
      <div className="chat-quick-controls">
        <PlaygroundControlTooltip
          title="Attach Files"
          lines={[
            `Attach local files for this turn (up to ${maxMessageAttachmentFiles}).`,
            `Supported format: ${messageAttachmentFormatHint}.`,
            "Attachments are sent together with the current message.",
          ]}
        >
          <div className="chat-quick-control">
            <Button
              type="button"
              appearance="subtle"
              className="chat-attach-btn"
              aria-label="Attach files"
              title="Attach files"
              onClick={onOpenMessageAttachmentPicker}
              disabled={isSending || isChatLocked || isThreadReadOnly}
            >
              📎
            </Button>
          </div>
        </PlaygroundControlTooltip>
        <PlaygroundControlTooltip
          title="Project"
          lines={[
            isLoadingAzureConnections
              ? "Loading project names from Azure..."
              : isAzureAuthRequired
                ? "Click the selector to start Azure login."
                : azureConnections.length === 0
                  ? "Selected tenant has no available projects."
                  : "Used for this chat request.",
          ]}
        >
          <div className="chat-quick-control">{projectControl}</div>
        </PlaygroundControlTooltip>
        <PlaygroundControlTooltip
          title="Deployment"
          lines={[
            isLoadingAzureConnections || isLoadingAzureDeployments
              ? "Loading deployment names for the selected project..."
              : isAzureAuthRequired
                ? "Click the selector to start Azure login."
                : !activeAzureConnectionId
                  ? azureConnections.length === 0
                    ? "Selected tenant has no available deployments."
                    : "Select a project first."
                  : azureDeployments.length === 0
                    ? "Selected tenant has no available deployments."
                    : "Used to run the model.",
          ]}
        >
          <div className="chat-quick-control">{deploymentControl}</div>
        </PlaygroundControlTooltip>
        <PlaygroundControlTooltip
          title="Reasoning Effort"
          lines={
            isReasoningEffortSupported
              ? [
                  "Controls how much internal reasoning the model uses. Available values are loaded per deployment.",
                ]
              : [
                  "This deployment does not support Reasoning Effort. Value is fixed to None and omitted from requests.",
                ]
          }
        >
          <div className="chat-quick-control">
            <QuickControlFrame className="chat-quick-control-frame">
              <Select
                id="chat-reasoning-effort"
                aria-label="Reasoning Effort"
                title={
                  isReasoningEffortSupported
                    ? "Reasoning effort level for the model."
                    : "This deployment does not support Reasoning Effort."
                }
                value={reasoningEffort}
                onChange={(event) =>
                  onReasoningEffortChange(event.target.value as ReasoningEffort)
                }
                disabled={isSending || !isReasoningEffortSupported}
              >
                <optgroup label="Reasoning effort">
                  {reasoningEffortOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </QuickControlFrame>
          </div>
        </PlaygroundControlTooltip>
        <PlaygroundControlTooltip
          title="Web Search"
          lines={["Enable Azure web-search-preview tool for this thread."]}
        >
          <div className="chat-quick-control">
            <QuickControlFrame className="chat-quick-control-frame chat-quick-control-frame-switch">
              <Switch
                id="chat-web-search-preview"
                className="chat-web-search-toggle"
                aria-label="Web Search"
                label="Web Search"
                checked={webSearchEnabled}
                onChange={(_, data) => {
                  onWebSearchEnabledChange(data.checked === true);
                }}
                disabled={isSending}
              />
            </QuickControlFrame>
          </div>
        </PlaygroundControlTooltip>
      </div>
      <PlaygroundControlTooltip
        title={isSending ? "Cancel" : "Send"}
        lines={
          isSending
            ? ["Cancel all in-progress processing for this thread."]
            : isThreadReadOnly
              ? [
                  "Archived thread is read-only. Restore it from Archives to send messages.",
                ]
              : ["Send current message."]
        }
        className="chat-tooltip-target chat-send-tooltip-target"
      >
        {isSending ? (
          <Button
            type="button"
            appearance="subtle"
            className="chat-send-btn"
            aria-label="Cancel in-progress processing"
            title="Cancel in-progress processing."
            onClick={onCancelThreadProcessing}
          >
            ■
          </Button>
        ) : (
          <Button
            type="submit"
            appearance="subtle"
            className="chat-send-btn"
            aria-label="Send message"
            title="Send current message."
            disabled={!canSendMessage}
          >
            ↑
          </Button>
        )}
      </PlaygroundControlTooltip>
    </div>
  );
}
