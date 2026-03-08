/**
 * Client controller thread guard selectors.
 */
import {
  isThreadOperationPhaseBusy,
  type ThreadOperationPhase,
} from "~/lib/client/controller/thread-operation-phase";

export type ThreadOperationPhaseFlags = {
  isLoadingThreads: boolean;
  isSwitchingThread: boolean;
  isCreatingThread: boolean;
  isDeletingThread: boolean;
  isClearingThread: boolean;
  isRestoringThread: boolean;
  isThreadOperationBusy: boolean;
};

export type SendMessageGuardInput = {
  threadOperationPhase: ThreadOperationPhase;
  isSending: boolean;
  isActiveThreadArchived: boolean;
  isChatLocked: boolean;
  isLoadingAzureConnections: boolean;
  isLoadingPlaygroundAzureDeployments: boolean;
  hasActiveThreadId: boolean;
  hasActivePlaygroundAzureConnection: boolean;
  hasSelectedPlaygroundAzureDeploymentName: boolean;
  isSelectedPlaygroundReasoningEffortOptionAvailable: boolean;
  isPlaygroundReasoningEffortWebSearchCompatible: boolean;
  hasDraftContent: boolean;
};

export function selectThreadOperationPhaseFlags(
  threadOperationPhase: ThreadOperationPhase,
): ThreadOperationPhaseFlags {
  return {
    isLoadingThreads: threadOperationPhase === "loading",
    isSwitchingThread: threadOperationPhase === "switching",
    isCreatingThread: threadOperationPhase === "creating",
    isDeletingThread: threadOperationPhase === "deleting",
    isClearingThread: threadOperationPhase === "clearing",
    isRestoringThread: threadOperationPhase === "restoring",
    isThreadOperationBusy: isThreadOperationPhaseBusy(threadOperationPhase),
  };
}

export function isThreadPhaseBlockingSend(threadOperationPhase: ThreadOperationPhase): boolean {
  return (
    threadOperationPhase === "loading" ||
    threadOperationPhase === "switching" ||
    threadOperationPhase === "deleting" ||
    threadOperationPhase === "clearing" ||
    threadOperationPhase === "restoring"
  );
}

export function shouldBlockThreadPersistence(options: {
  threadOperationPhase: ThreadOperationPhase;
  isSending: boolean;
  blockOnCreating: boolean;
}): boolean {
  if (options.isSending) {
    return true;
  }

  if (options.blockOnCreating) {
    return isThreadOperationPhaseBusy(options.threadOperationPhase);
  }

  return isThreadPhaseBlockingSend(options.threadOperationPhase);
}

export function canSendMessageByGuard(input: SendMessageGuardInput): boolean {
  if (input.isSending) {
    return false;
  }
  if (isThreadPhaseBlockingSend(input.threadOperationPhase)) {
    return false;
  }
  if (input.isActiveThreadArchived) {
    return false;
  }
  if (input.isChatLocked) {
    return false;
  }
  if (input.isLoadingAzureConnections || input.isLoadingPlaygroundAzureDeployments) {
    return false;
  }
  if (!input.hasActiveThreadId || !input.hasActivePlaygroundAzureConnection) {
    return false;
  }
  if (!input.hasSelectedPlaygroundAzureDeploymentName) {
    return false;
  }
  if (!input.isSelectedPlaygroundReasoningEffortOptionAvailable) {
    return false;
  }
  if (!input.isPlaygroundReasoningEffortWebSearchCompatible) {
    return false;
  }

  return input.hasDraftContent;
}
