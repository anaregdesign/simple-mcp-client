export type SendPreconditionViolation = {
  type: "thread_error" | "ui_error";
  message: string;
  targetTab?: "threads" | "settings";
};

export function validateSendPreconditions(options: {
  content: string;
  threadId: string;
  isArchivedThread: boolean;
  isThreadSending: boolean;
  isThreadPhaseBlockingSend: boolean;
  isChatLocked: boolean;
  hasActivePlaygroundAzureConnection: boolean;
  isAzureAuthRequired: boolean;
  isLoadingPlaygroundAzureDeployments: boolean;
  deploymentName: string;
  isSelectedDeploymentValid: boolean;
  isPlaygroundReasoningEffortSupported: boolean;
  isSelectedPlaygroundReasoningEffortOptionAvailable: boolean;
  webSearchEnabled: boolean;
  isPlaygroundReasoningEffortWebSearchCompatible: boolean;
}): SendPreconditionViolation | null {
  if (!options.content) {
    return null;
  }

  if (!options.threadId) {
    return {
      type: "thread_error",
      targetTab: "threads",
      message: "Select or create a thread before sending.",
    };
  }

  if (options.isArchivedThread) {
    return {
      type: "thread_error",
      targetTab: "threads",
      message: "Archived thread is read-only. Restore it from Archives to continue.",
    };
  }

  if (options.isThreadSending) {
    return {
      type: "thread_error",
      message: "",
    };
  }

  if (options.isThreadPhaseBlockingSend) {
    return {
      type: "thread_error",
      targetTab: "threads",
      message: "Thread state is updating. Please wait.",
    };
  }

  if (options.isChatLocked) {
    return {
      type: "ui_error",
      targetTab: "settings",
      message: "Playground is unavailable while logged out. Open ⚙️ Settings and sign in.",
    };
  }

  if (!options.hasActivePlaygroundAzureConnection) {
    return {
      type: "ui_error",
      message: options.isAzureAuthRequired
        ? "Azure login is required. Click Project or Deployment and sign in."
        : "No Azure project is available. Check your Azure account permissions.",
    };
  }

  if (options.isLoadingPlaygroundAzureDeployments) {
    return {
      type: "ui_error",
      message: "Deployment list is loading. Please wait.",
    };
  }

  if (!options.deploymentName || !options.isSelectedDeploymentValid) {
    return {
      type: "ui_error",
      message: "Select an Azure deployment before sending.",
    };
  }

  if (
    options.isPlaygroundReasoningEffortSupported &&
    !options.isSelectedPlaygroundReasoningEffortOptionAvailable
  ) {
    return {
      type: "ui_error",
      message: "Select a Reasoning Effort value available for the selected deployment before sending.",
    };
  }

  if (
    options.webSearchEnabled &&
    options.isPlaygroundReasoningEffortSupported &&
    !options.isPlaygroundReasoningEffortWebSearchCompatible
  ) {
    return {
      type: "ui_error",
      message:
        "Selected Reasoning Effort cannot be used with Web Search. Choose a Web Search-compatible value.",
    };
  }

  return null;
}
