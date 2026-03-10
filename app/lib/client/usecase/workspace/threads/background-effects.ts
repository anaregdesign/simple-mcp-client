import {
  useEffect,
  useEffectEvent,
  type MutableRefObject,
} from "react";
import { THREAD_DEFAULT_NAME } from "~/lib/domain/value-objects/thread-defaults";
import { normalizeThreadName } from "~/lib/domain/value-objects/thread-name";
import {
  hasThreadInteraction,
} from "~/lib/client/usecase/workspace/threads/thread-save-state";
import {
  buildThreadPersistencePlanFromCurrentState,
} from "~/lib/client/usecase/workspace/threads/thread-persistence-plan";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { ThreadOperationPhase } from "~/lib/client/usecase/workspace/threads/thread-operation-phase";
import { canStartThreadOperation } from "~/lib/client/usecase/workspace/threads/thread-operation-phase";
import { shouldBlockThreadPersistence } from "~/lib/client/usecase/workspace/threads/thread-guards";

type TitleRefreshReason =
  | "first_message"
  | "instruction_update"
  | "utility_deployment_update";

type UseWorkspaceThreadBackgroundEffectsOptions = {
  activeThreadId: string;
  activeThreadNameInput: string;
  agentInstruction: string;
  instructionContextToggles: ThreadState["instructionContextToggles"];
  isChatLocked: boolean;
  isLoadingUtilityAzureDeployments: boolean;
  isSending: boolean;
  mcpRpcLogs: ThreadState["mcpRpcLogs"];
  mcpServers: ThreadState["mcpServers"];
  messages: ThreadState["messages"];
  reasoningEffort: ReasoningEffort;
  selectedThreadSkills: ThreadState["skillSelections"];
  selectedUtilityAzureConnectionId: string;
  selectedUtilityAzureDeploymentName: string;
  threadOperationPhase: ThreadOperationPhase;
  threads: ThreadState[];
  utilityAzureDeployments: Array<{ name: string }>;
  webSearchEnabled: boolean;
  readIsThreadsReady: () => boolean;
  readIsApplyingThreadState: () => boolean;
  activeThreadIdRef: MutableRefObject<string>;
  clearThreadNameSaveTimeout: () => void;
  clearThreadSaveTimeout: () => void;
  clearThreadTitleRefreshTimeout: () => void;
  scheduleThreadNameSaveTimeout: (onElapsed: () => void) => void;
  scheduleThreadSaveTimeout: (onElapsed: () => void) => void;
  scheduleThreadTitleRefreshTimeout: (onElapsed: () => void) => void;
  readThreadById: (threadId: string) => ThreadState | undefined;
  isArchivedThread: (threadId: string) => boolean;
  isSelectedUtilityDeploymentAvailable: (deploymentName: string) => boolean;
  buildThreadStateFromCurrentState: (
    base: ThreadState,
    options?: {
      includeDraftName?: boolean;
    },
  ) => ThreadState;
  readSavedThreadSignature: (threadId: string) => string | undefined;
  saveThreadStateToDatabase: (
    thread: ThreadState,
  ) => Promise<boolean>;
  saveActiveThreadNameInBackground: (
    threadId: string,
    name: string,
  ) => Promise<void>;
  refreshThreadTitleInBackground: (options: {
    threadId: string;
    reason: TitleRefreshReason;
    instructionOverride?: string;
  }) => Promise<void>;
};

export function useWorkspaceThreadBackgroundEffects(
  options: UseWorkspaceThreadBackgroundEffectsOptions,
) {
  const persistThreadState = useEffectEvent(
    async (thread: ThreadState) => {
      await options.saveThreadStateToDatabase(thread);
    },
  );

  const persistThreadName = useEffectEvent(
    async (threadId: string, name: string) => {
      await options.saveActiveThreadNameInBackground(threadId, name);
    },
  );

  const refreshThreadTitle = useEffectEvent(
    async (refreshOptions: {
      threadId: string;
      reason: TitleRefreshReason;
      instructionOverride?: string;
    }) => {
      await options.refreshThreadTitleInBackground(refreshOptions);
    },
  );

  useEffect(() => {
    return () => {
      options.clearThreadTitleRefreshTimeout();
      options.clearThreadNameSaveTimeout();
      options.clearThreadSaveTimeout();
    };
  }, []);

  useEffect(() => {
    if (!options.readIsThreadsReady() || options.readIsApplyingThreadState()) {
      return;
    }
    if (
      shouldBlockThreadPersistence({
        threadOperationPhase: options.threadOperationPhase,
        isSending: options.isSending,
        blockOnCreating: false,
      })
    ) {
      return;
    }

    const currentThreadId = options.activeThreadIdRef.current.trim();
    if (!currentThreadId) {
      return;
    }

    const baseThread = options.readThreadById(currentThreadId);
    if (!baseThread) {
      return;
    }

    const persistencePlan = buildThreadPersistencePlanFromCurrentState({
      baseThread,
      buildThreadStateFromCurrentState: options.buildThreadStateFromCurrentState,
      readSavedThreadSignature: options.readSavedThreadSignature,
    });
    if (!persistencePlan) {
      return;
    }

    options.clearThreadSaveTimeout();
    options.scheduleThreadSaveTimeout(() => {
      void persistThreadState(persistencePlan.snapshot);
    });

    return () => {
      options.clearThreadSaveTimeout();
    };
  }, [
    options.activeThreadId,
    options.reasoningEffort,
    options.webSearchEnabled,
    options.agentInstruction,
    options.instructionContextToggles,
    options.messages,
    options.mcpServers,
    options.mcpRpcLogs,
    options.selectedThreadSkills,
    options.threads,
    options.isSending,
    options.threadOperationPhase,
  ]);

  useEffect(() => {
    if (!options.readIsThreadsReady() || options.readIsApplyingThreadState()) {
      return;
    }
    if (
      shouldBlockThreadPersistence({
        threadOperationPhase: options.threadOperationPhase,
        isSending: options.isSending,
        blockOnCreating: true,
      })
    ) {
      return;
    }

    const currentThreadId = options.activeThreadIdRef.current.trim();
    if (!currentThreadId) {
      return;
    }

    const baseThread = options.readThreadById(currentThreadId);
    if (!baseThread) {
      return;
    }

    const trimmedName = normalizeThreadName(options.activeThreadNameInput);
    const nextName = trimmedName || baseThread.name;
    if (nextName === baseThread.name) {
      return;
    }

    const persistencePlan = buildThreadPersistencePlanFromCurrentState({
      baseThread,
      buildThreadStateFromCurrentState: options.buildThreadStateFromCurrentState,
      readSavedThreadSignature: options.readSavedThreadSignature,
      includeDraftName: true,
      mapSnapshot: (snapshot) => ({
        ...snapshot,
        name: nextName,
      }),
    });
    if (!persistencePlan) {
      return;
    }

    options.clearThreadNameSaveTimeout();
    options.scheduleThreadNameSaveTimeout(() => {
      void persistThreadName(currentThreadId, nextName);
    });

    return () => {
      options.clearThreadNameSaveTimeout();
    };
  }, [
    options.activeThreadId,
    options.activeThreadNameInput,
    options.threads,
    options.isSending,
    options.threadOperationPhase,
  ]);

  useEffect(() => {
    if (!options.readIsThreadsReady() || options.readIsApplyingThreadState()) {
      return;
    }
    if (!canStartThreadOperation(options.threadOperationPhase)) {
      return;
    }

    const currentThreadId = options.activeThreadIdRef.current.trim();
    if (!currentThreadId || options.isArchivedThread(currentThreadId)) {
      return;
    }

    const baseThread = options.readThreadById(currentThreadId);
    if (!baseThread || !hasThreadInteraction(baseThread)) {
      return;
    }

    const currentInstruction = options.agentInstruction.trim();
    const baseInstruction = baseThread.agentInstruction.trim();
    if (currentInstruction === baseInstruction) {
      return;
    }

    options.clearThreadTitleRefreshTimeout();
    options.scheduleThreadTitleRefreshTimeout(() => {
      void refreshThreadTitle({
        threadId: currentThreadId,
        reason: "instruction_update",
      });
    });

    return () => {
      options.clearThreadTitleRefreshTimeout();
    };
  }, [
    options.activeThreadId,
    options.agentInstruction,
    options.threads,
    options.threadOperationPhase,
  ]);

  useEffect(() => {
    if (!options.readIsThreadsReady() || options.readIsApplyingThreadState()) {
      return;
    }
    if (!canStartThreadOperation(options.threadOperationPhase)) {
      return;
    }
    if (options.isChatLocked || options.isLoadingUtilityAzureDeployments) {
      return;
    }

    const deploymentName = options.selectedUtilityAzureDeploymentName.trim();
    if (
      !deploymentName ||
      !options.isSelectedUtilityDeploymentAvailable(deploymentName)
    ) {
      return;
    }

    const currentThreadId = options.activeThreadIdRef.current.trim();
    if (!currentThreadId || options.isArchivedThread(currentThreadId)) {
      return;
    }

    const baseThread = options.readThreadById(currentThreadId);
    if (!baseThread || !hasThreadInteraction(baseThread)) {
      return;
    }
    if (baseThread.name.trim() !== THREAD_DEFAULT_NAME) {
      return;
    }

    void refreshThreadTitle({
      threadId: currentThreadId,
      reason: "utility_deployment_update",
    });
  }, [
    options.isChatLocked,
    options.threadOperationPhase,
    options.isLoadingUtilityAzureDeployments,
    options.selectedUtilityAzureConnectionId,
    options.selectedUtilityAzureDeploymentName,
    options.utilityAzureDeployments,
  ]);
}
