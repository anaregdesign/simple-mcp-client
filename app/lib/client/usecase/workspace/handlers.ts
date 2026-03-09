import type { ChangeEvent } from "react";
import type { MainViewTab, McpTransport } from "~/lib/client/usecase/workspace/view-types";
import { DEFAULT_AGENT_INSTRUCTION } from "~/lib/constants/chat";
import { THREAD_NAME_MAX_LENGTH } from "~/lib/constants/client";
import {
  INSTRUCTION_ALLOWED_EXTENSIONS,
  INSTRUCTION_MAX_FILE_SIZE_BYTES,
  INSTRUCTION_MAX_FILE_SIZE_LABEL,
} from "~/lib/constants/instruction";
import { MCP_DEFAULT_AZURE_AUTH_SCOPE } from "~/lib/constants/mcp";
import type { SkillRegistryId } from "~/lib/contracts/skills/registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
  ThreadSkillActivation,
} from "~/lib/contracts/skills/types";
import {
  buildMcpServerKey,
  type McpServerConfig,
} from "~/lib/contracts/mcp/profile";
import {
  parseAzureAuthScopeInput,
  parseHttpHeadersInput,
  parseMcpTimeoutSecondsInput,
} from "~/lib/client/usecase/workspace/mcp-http-inputs";
import {
  parseStdioArgsInput,
  parseStdioEnvInput,
} from "~/lib/client/usecase/workspace/mcp-stdio-inputs";
import { createId } from "~/lib/client/usecase/workspace/ids";
import type {
  ThreadInstructionContextToggles,
  ThreadInstructionContextToggleKey,
} from "~/lib/contracts/threads/instruction-context";
import {
  convertThreadResourceToState,
  readThreadResourceFromUnknown,
} from "~/lib/contracts/threads/parsers";
import {
  buildThreadSaveSignature,
  hasThreadInteraction,
  hasThreadPersistableState,
  upsertThreadState,
} from "~/lib/contracts/threads/state";
import type { ThreadState } from "~/lib/contracts/threads/types";
import {
  ClientApiError,
  mapApiError,
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/infrastructure/api/api-client";
import { readJsonPayload } from "~/lib/client/infrastructure/api/http";
import { getFileExtension } from "~/lib/client/usecase/workspace/files";
import {
  canStartThreadOperation,
  type ThreadOperationPhase,
} from "~/lib/client/usecase/workspace/thread-operation-phase";
import { findThreadStateById } from "~/lib/client/usecase/workspace/thread-runtime";
import type {
  InstructionEnhanceComparison,
  ThreadRequestState,
  ThreadsApiResponse,
} from "~/lib/client/usecase/workspace/types";

type ThreadLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type ThreadLifecycleHandlerDependencies = {
  isSending: boolean;
  threadOperationPhase: ThreadOperationPhase;
  readThreads: () => ThreadState[];
  readActiveThreadId: () => string;
  beginThreadOperation: (
    phase: Exclude<ThreadOperationPhase, "idle">,
  ) => boolean;
  endThreadOperation: (
    expectedPhase: Exclude<ThreadOperationPhase, "idle">,
  ) => void;
  readThreadRequestState: (threadId: string) => ThreadRequestState;
  updateThreadStateById: (
    threadId: string,
    updater: (current: ThreadState) => ThreadState,
  ) => void;
  updateThreadsState: (
    updater: (current: ThreadState[]) => ThreadState[],
  ) => ThreadState[];
  hasSavedThreadSignature: (threadId: string) => boolean;
  setThreadsReady: () => void;
  rememberThreadSaveSignature: (thread: ThreadState) => void;
  applyThreadState: (thread: ThreadState) => void;
  buildThreadStateFromCurrentState: (
    base: ThreadState,
    options?: {
      includeDraftName?: boolean;
    },
  ) => ThreadState;
  saveThreadStateToDatabase: (
    thread: ThreadState,
    signature: string,
  ) => Promise<boolean>;
  flushActiveThreadState: () => Promise<boolean>;
  cancelThreadInProgressProcessing: (threadId: string) => boolean;
  createLocalThreadState: (options?: { name?: string }) => ThreadState;
  loadThreads: () => Promise<void>;
  removeThreadRequestState: (threadId: string) => void;
  setThreadError: (message: string | null) => void;
  setSystemNotice: (message: string | null) => void;
  setActiveMainTab: (tab: MainViewTab) => void;
  setActiveThreadNameInput: (name: string) => void;
  markAzureAuthRequired: () => void;
  logClientInfo: (
    eventName: string,
    message: string,
    options?: ThreadLogOptions,
  ) => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: ThreadLogOptions,
  ) => void;
};

export type ThreadLifecycleHandlers = {
  handleCreateThread: () => Promise<void>;
  handleThreadRename: (
    threadIdRaw: string,
    nextNameRaw: string,
  ) => Promise<void>;
  handleThreadCancel: (threadIdRaw: string) => void;
  handleThreadClear: (threadIdRaw: string) => Promise<void>;
  handleThreadLogicalDelete: (threadIdRaw: string) => Promise<void>;
  handleThreadRestore: (threadIdRaw: string) => Promise<void>;
  handleThreadChange: (nextThreadIdRaw: string) => Promise<void>;
};

type SkillSelectionHandlerDependencies = {
  availableSkillByLocation: Map<string, SkillCatalogEntry>;
  skillRegistryCatalogs: SkillRegistryCatalog[];
  readActiveThreadId: () => string;
  updateThreadStateById: (
    threadId: string,
    updater: (current: ThreadState) => ThreadState,
  ) => void;
  setSelectedMessageSkillActivations: (
    updater: (
      current: ThreadSkillActivation[],
    ) => ThreadSkillActivation[],
  ) => void;
  setSkillsError: (message: string | null) => void;
  updateSkillRegistrySkill: (options: {
    action: "install_registry_skill" | "delete_registry_skill";
    registryId: SkillRegistryId;
    skillName: string;
  }) => Promise<void>;
};

export type SkillSelectionHandlers = {
  handleToggleRegistrySkill: (
    registryId: SkillRegistryId,
    skillIdRaw: string,
  ) => void;
  handleAddMessageSkillActivation: (locationRaw: string) => void;
  handleRemoveMessageSkillActivation: (locationRaw: string) => void;
  handleAddThreadSkill: (locationRaw: string) => void;
  handleRemoveThreadSkill: (locationRaw: string) => void;
  handleToggleThreadSkill: (locationRaw: string) => void;
};

type McpProfileHandlerDependencies = {
  isArchivedThread: (threadIdRaw: string) => boolean;
  readActiveThreadId: () => string;
  readWorkspaceMcpServerProfiles: () => McpServerConfig[];
  readActiveThreadMcpServers: () => McpServerConfig[];
  readEditingMcpServerId: () => string;
  isDeletingWorkspaceMcpServerProfile: boolean;
  setWorkspaceMcpServerProfileError: (value: string | null) => void;
  loadWorkspaceMcpServerProfiles: () => Promise<void>;
  clearMcpServerEditState: () => void;
  setEditingMcpServerId: (value: string) => void;
  populateMcpServerFormForEdit: (server: McpServerConfig) => void;
  setMcpFormError: (value: string | null) => void;
  setMcpFormWarning: (value: string | null) => void;
  setIsDeletingWorkspaceMcpServerProfile: (value: boolean) => void;
  setIsSavingMcpServer: (value: boolean) => void;
  applyWorkspaceMcpServerProfiles: (profiles: McpServerConfig[]) => void;
  deleteWorkspaceMcpServerProfileFromConfig: (
    serverId: string,
  ) => Promise<McpServerConfig[]>;
  saveMcpServerToConfig: (
    server: McpServerConfig,
    options?: {
      isUpdate?: boolean;
    },
  ) => Promise<{
    profile: McpServerConfig;
    warning: string | null;
  }>;
  connectMcpServerToAgent: (serverToConnect: McpServerConfig) => void;
  resetMcpServerFormInputs: () => void;
  updateThreadStateById: (
    threadId: string,
    updater: (current: ThreadState) => ThreadState,
  ) => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: ThreadLogOptions,
  ) => void;
  logClientWarning: (
    eventName: string,
    message: string,
    options?: ThreadLogOptions,
  ) => void;
  mcpFormState: {
    editingMcpServerId: string;
    mcpNameInput: string;
    mcpTransport: McpTransport;
    mcpUrlInput: string;
    mcpCommandInput: string;
    mcpArgsInput: string;
    mcpCwdInput: string;
    mcpEnvInput: string;
    mcpHeadersInput: string;
    mcpUseAzureAuthInput: boolean;
    mcpAzureAuthScopeInput: string;
    mcpTimeoutSecondsInput: string;
  };
};

export type McpProfileHandlers = {
  handleReloadWorkspaceMcpServerProfiles: () => void;
  handleCancelMcpServerEdit: () => void;
  handleEditWorkspaceMcpServerProfile: (serverIdRaw: string) => void;
  handleDeleteWorkspaceMcpServerProfile: (
    serverIdRaw: string,
  ) => Promise<void>;
  handleToggleWorkspaceMcpServerProfile: (serverIdRaw: string) => void;
  handleRemoveMcpServer: (id: string) => void;
  handleAddMcpServer: () => Promise<void>;
};

type InstructionEditingHandlerDependencies = {
  isArchivedThread: (threadIdRaw: string) => boolean;
  readActiveThreadId: () => string;
  setInstructionContextToggles: (
    updater: (
      current: ThreadInstructionContextToggles,
    ) => ThreadInstructionContextToggles,
  ) => void;
  setAgentInstruction: (value: string) => void;
  setLoadedInstructionFileName: (value: string | null) => void;
  setInstructionFileError: (value: string | null) => void;
  setInstructionSaveError: (value: string | null) => void;
  setInstructionSaveSuccess: (value: string | null) => void;
  setInstructionEnhanceError: (value: string | null) => void;
  setInstructionEnhanceSuccess: (value: string | null) => void;
  setInstructionEnhanceComparison: (
    value: InstructionEnhanceComparison | null,
  ) => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: ThreadLogOptions,
  ) => void;
};

export type InstructionEditingHandlers = {
  handleInstructionContextToggleChange: (
    toggleKey: ThreadInstructionContextToggleKey,
    nextValue: boolean,
  ) => void;
  handleAgentInstructionChange: (value: string) => void;
  handleClearInstruction: () => void;
  handleInstructionFileChange: (
    event: ChangeEvent<HTMLInputElement>,
  ) => Promise<void>;
};

export function createThreadLifecycleHandlers(
  deps: ThreadLifecycleHandlerDependencies,
): ThreadLifecycleHandlers {
  async function createThreadAndSwitch(
    options: {
      name?: string;
    } = {},
  ): Promise<boolean> {
    if (!deps.beginThreadOperation("creating")) {
      return false;
    }

    deps.setThreadError(null);

    try {
      const currentThreadId = deps.readActiveThreadId().trim();
      const currentThread = findThreadStateById(deps.readThreads(), currentThreadId);
      const currentThreadState = currentThread
        ? deps.buildThreadStateFromCurrentState(currentThread)
        : null;

      if (
        currentThread &&
        currentThreadState &&
        !hasThreadPersistableState(currentThreadState) &&
        !deps.hasSavedThreadSignature(currentThread.id)
      ) {
        deps.applyThreadState(currentThread);
        return true;
      }

      if (!deps.readThreadRequestState(currentThreadId).isSending) {
        const saved = await deps.flushActiveThreadState();
        if (!saved) {
          return false;
        }
      }

      const localThread = deps.createLocalThreadState({
        name: options.name,
      });
      deps.updateThreadsState((current) => upsertThreadState(current, localThread));
      deps.setThreadsReady();
      deps.applyThreadState(localThread);
      deps.logClientInfo("create_thread_succeeded", "Thread created.", {
        action: "create_thread",
        context: {
          threadId: localThread.id,
          nameLength: localThread.name.length,
        },
      });
      return true;
    } catch (createError) {
      deps.logClientError("create_thread_failed", createError, {
        action: "create_thread",
        statusCode: 500,
      });
      deps.setThreadError(
        createError instanceof Error
          ? createError.message
          : "Failed to create thread.",
      );
      return false;
    } finally {
      deps.endThreadOperation("creating");
    }
  }

  return {
    async handleCreateThread() {
      const created = await createThreadAndSwitch({
        name: "",
      });
      if (created) {
        deps.setActiveMainTab("threads");
      }
    },

    async handleThreadRename(
      threadIdRaw: string,
      nextNameRaw: string,
    ): Promise<void> {
      const threadId = threadIdRaw.trim();
      if (!threadId) {
        return;
      }

      const normalizedName = nextNameRaw.trim().slice(0, THREAD_NAME_MAX_LENGTH);
      if (!normalizedName) {
        deps.setThreadError("Thread name cannot be empty.");
        return;
      }

      if (deps.isSending) {
        deps.setThreadError("Thread state is updating. Please wait.");
        return;
      }

      if (!deps.beginThreadOperation("clearing")) {
        return;
      }

      const targetThread = findThreadStateById(deps.readThreads(), threadId);
      if (!targetThread || targetThread.deletedAt !== null) {
        deps.setThreadError("Selected thread is not available.");
        return;
      }

      if (deps.readThreadRequestState(threadId).isSending) {
        deps.setThreadError("Cannot rename a thread while a response is in progress.");
        return;
      }

      if (targetThread.name === normalizedName) {
        return;
      }

      deps.setThreadError(null);
      deps.updateThreadStateById(threadId, (thread) => ({
        ...thread,
        updatedAt: new Date().toISOString(),
        name: normalizedName,
      }));

      if (threadId === deps.readActiveThreadId().trim()) {
        deps.setActiveThreadNameInput(normalizedName);
      }

      const renamedThread = findThreadStateById(deps.readThreads(), threadId);
      if (!renamedThread) {
        return;
      }

      const signature = buildThreadSaveSignature(renamedThread);
      await deps.saveThreadStateToDatabase(renamedThread, signature);
    },

    handleThreadCancel(threadIdRaw: string): void {
      const threadId = threadIdRaw.trim();
      if (!threadId) {
        return;
      }

      const targetThread = findThreadStateById(deps.readThreads(), threadId);
      if (!targetThread || targetThread.deletedAt !== null) {
        deps.setThreadError("Selected thread is not available.");
        return;
      }

      const canceled = deps.cancelThreadInProgressProcessing(threadId);
      if (!canceled) {
        return;
      }

      deps.setThreadError(null);
      deps.setSystemNotice(
        `Canceled in-progress processing for thread ${targetThread.name}.`,
      );
      deps.logClientInfo(
        "cancel_thread_processing_succeeded",
        "Thread processing canceled.",
        {
          action: "cancel_thread_processing",
          context: {
            threadId,
          },
        },
      );
    },

    async handleThreadClear(threadIdRaw: string): Promise<void> {
      const threadId = threadIdRaw.trim();
      if (!threadId) {
        return;
      }

      if (deps.isSending) {
        deps.setThreadError("Thread state is updating. Please wait.");
        return;
      }

      if (!canStartThreadOperation(deps.threadOperationPhase)) {
        return;
      }

      const targetThread = findThreadStateById(deps.readThreads(), threadId);
      if (!targetThread || targetThread.deletedAt !== null) {
        deps.setThreadError("Selected thread is not available.");
        return;
      }

      if (deps.readThreadRequestState(threadId).isSending) {
        deps.setThreadError("Cannot clear a thread while a response is in progress.");
        return;
      }

      if (targetThread.messages.length === 0 && targetThread.mcpRpcLogs.length === 0) {
        return;
      }

      deps.setThreadError(null);

      try {
        const targetThreadForSave =
          threadId === deps.readActiveThreadId().trim()
            ? (() => {
                const activeThread = findThreadStateById(deps.readThreads(), threadId);
                if (!activeThread) {
                  return null;
                }
                const snapshot = deps.buildThreadStateFromCurrentState(activeThread, {
                  includeDraftName: true,
                });
                return {
                  ...snapshot,
                  messages: [],
                  mcpRpcLogs: [],
                };
              })()
            : {
                ...targetThread,
                updatedAt: new Date().toISOString(),
                messages: [],
                mcpRpcLogs: [],
              };

        if (!targetThreadForSave) {
          return;
        }

        deps.updateThreadsState((current) => upsertThreadState(current, targetThreadForSave));
        deps.removeThreadRequestState(threadId);

        if (threadId === deps.readActiveThreadId().trim()) {
          deps.applyThreadState(targetThreadForSave);
        }

        const signature = buildThreadSaveSignature(targetThreadForSave);
        const saved = await deps.saveThreadStateToDatabase(
          targetThreadForSave,
          signature,
        );
        if (!saved) {
          return;
        }

        deps.logClientInfo("clear_thread_succeeded", "Thread content cleared.", {
          action: "clear_thread",
          context: {
            threadId,
          },
        });
      } catch (clearError) {
        deps.logClientError("clear_thread_failed", clearError, {
          action: "clear_thread",
          statusCode: 500,
          context: {
            threadId,
          },
        });
        deps.setThreadError(
          clearError instanceof Error
            ? clearError.message
            : "Failed to clear thread.",
        );
      } finally {
        deps.endThreadOperation("clearing");
      }
    },

    async handleThreadLogicalDelete(threadIdRaw: string): Promise<void> {
      const threadId = threadIdRaw.trim();
      if (!threadId) {
        return;
      }

      if (deps.isSending) {
        deps.setThreadError("Thread state is updating. Please wait.");
        return;
      }

      if (!deps.beginThreadOperation("deleting")) {
        return;
      }

      const targetThread = findThreadStateById(deps.readThreads(), threadId);
      if (!targetThread || targetThread.deletedAt !== null) {
        deps.setThreadError("Selected thread is not available.");
        return;
      }
      if (!hasThreadInteraction(targetThread)) {
        deps.setThreadError("Threads without messages cannot be deleted.");
        return;
      }

      if (deps.readThreadRequestState(threadId).isSending) {
        deps.setThreadError("Cannot delete a thread while a response is in progress.");
        return;
      }

      deps.setThreadError(null);

      try {
        const currentThreadId = deps.readActiveThreadId().trim();
        if (!deps.readThreadRequestState(currentThreadId).isSending) {
          const saved = await deps.flushActiveThreadState();
          if (!saved) {
            return;
          }
        }

        const { payload } = await requestClientApi<ThreadsApiResponse>({
          url: `/api/threads/${encodeURIComponent(threadId)}`,
          init: {
            method: "DELETE",
          },
          readPayload: (response) =>
            readJsonPayload<ThreadsApiResponse>(response, "Threads"),
          resolveAuthRequired: (status, responsePayload) =>
            resolveAuthRequired(status, responsePayload),
          readErrorMessage: (responsePayload) =>
            typeof responsePayload.error === "string"
              ? responsePayload.error
              : null,
          fallbackErrorMessage: "Failed to delete thread.",
          authRequiredMessage:
            "Azure login is required. Open Settings and sign in to continue.",
          onAuthRequired: () => {
            deps.markAzureAuthRequired();
          },
        });

        const deletedThreadResource = readThreadResourceFromUnknown(payload.thread);
        const deletedThread = deletedThreadResource
          ? convertThreadResourceToState(deletedThreadResource, {
              fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
            })
          : null;
        if (
          !deletedThread ||
          deletedThread.id !== threadId ||
          deletedThread.deletedAt === null
        ) {
          throw new Error("Deleted thread payload is invalid.");
        }

        deps.removeThreadRequestState(threadId);
        await deps.loadThreads();
        deps.logClientInfo("delete_thread_succeeded", "Thread archived.", {
          action: "delete_thread",
          context: {
            threadId,
          },
        });
      } catch (deleteError) {
        if (
          deleteError instanceof ClientApiError &&
          deleteError.kind === "auth_required"
        ) {
          deps.setThreadError(deleteError.message);
          return;
        }
        deps.logClientError("delete_thread_failed", deleteError, {
          action: "delete_thread",
          statusCode: 500,
          context: {
            threadId,
          },
        });
        deps.setThreadError(mapApiError(deleteError, "Failed to delete thread."));
      } finally {
        deps.endThreadOperation("deleting");
      }
    },

    async handleThreadRestore(threadIdRaw: string): Promise<void> {
      const threadId = threadIdRaw.trim();
      if (!threadId) {
        return;
      }

      if (deps.isSending) {
        deps.setThreadError("Thread state is updating. Please wait.");
        return;
      }

      if (!deps.beginThreadOperation("restoring")) {
        return;
      }

      const targetThread = findThreadStateById(deps.readThreads(), threadId);
      if (!targetThread || targetThread.deletedAt === null) {
        deps.setThreadError("Selected archive is not available.");
        return;
      }

      deps.setThreadError(null);

      try {
        const currentThreadId = deps.readActiveThreadId().trim();
        if (!deps.readThreadRequestState(currentThreadId).isSending) {
          const saved = await deps.flushActiveThreadState();
          if (!saved) {
            return;
          }
        }

        const { payload } = await requestClientApi<ThreadsApiResponse>({
          url: `/api/threads/${encodeURIComponent(threadId)}`,
          init: {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              archived: false,
            }),
          },
          readPayload: (response) =>
            readJsonPayload<ThreadsApiResponse>(response, "Threads"),
          resolveAuthRequired: (status, responsePayload) =>
            resolveAuthRequired(status, responsePayload),
          readErrorMessage: (responsePayload) =>
            typeof responsePayload.error === "string"
              ? responsePayload.error
              : null,
          fallbackErrorMessage: "Failed to restore thread.",
          authRequiredMessage:
            "Azure login is required. Open Settings and sign in to continue.",
          onAuthRequired: () => {
            deps.markAzureAuthRequired();
          },
        });

        const restoredThreadResource = readThreadResourceFromUnknown(payload.thread);
        const restoredThread = restoredThreadResource
          ? convertThreadResourceToState(restoredThreadResource, {
              fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
            })
          : null;
        if (
          !restoredThread ||
          restoredThread.id !== threadId ||
          restoredThread.deletedAt !== null
        ) {
          throw new Error("Restored thread payload is invalid.");
        }

        deps.updateThreadsState((current) => upsertThreadState(current, restoredThread));
        deps.rememberThreadSaveSignature(restoredThread);
        deps.applyThreadState(restoredThread);
        deps.logClientInfo("restore_thread_succeeded", "Thread restored.", {
          action: "restore_thread",
          context: {
            threadId,
          },
        });
      } catch (restoreError) {
        if (
          restoreError instanceof ClientApiError &&
          restoreError.kind === "auth_required"
        ) {
          deps.setThreadError(restoreError.message);
          return;
        }
        deps.logClientError("restore_thread_failed", restoreError, {
          action: "restore_thread",
          statusCode: 500,
          context: {
            threadId,
          },
        });
        deps.setThreadError(mapApiError(restoreError, "Failed to restore thread."));
      } finally {
        deps.endThreadOperation("restoring");
      }
    },

    async handleThreadChange(nextThreadIdRaw: string): Promise<void> {
      const nextThreadId = nextThreadIdRaw.trim();
      deps.setThreadError(null);
      if (!nextThreadId || nextThreadId === deps.readActiveThreadId()) {
        return;
      }

      const nextThread = findThreadStateById(deps.readThreads(), nextThreadId);
      if (!nextThread) {
        deps.setThreadError("Selected thread is not available.");
        return;
      }
      if (!deps.beginThreadOperation("switching")) {
        return;
      }
      try {
        const currentThreadId = deps.readActiveThreadId().trim();
        if (!deps.readThreadRequestState(currentThreadId).isSending) {
          const saved = await deps.flushActiveThreadState();
          if (!saved) {
            return;
          }
        }

        deps.applyThreadState(nextThread);
        deps.logClientInfo("switch_thread_succeeded", "Thread switched.", {
          action: "switch_thread",
          context: {
            fromThreadId: currentThreadId,
            toThreadId: nextThread.id,
          },
        });
      } finally {
        deps.endThreadOperation("switching");
      }
    },
  };
}

export function createSkillSelectionHandlers(
  deps: SkillSelectionHandlerDependencies,
): SkillSelectionHandlers {
  return {
    handleToggleRegistrySkill(registryId, skillIdRaw) {
      const skillId = skillIdRaw.trim();
      if (!skillId) {
        return;
      }

      const registryCatalog = deps.skillRegistryCatalogs.find(
        (registry) => registry.registryId === registryId,
      );
      if (!registryCatalog) {
        return;
      }

      const selectedSkill = registryCatalog.skills.find(
        (skill) => skill.id === skillId,
      );
      if (!selectedSkill) {
        return;
      }

      void deps.updateSkillRegistrySkill({
        action:
          selectedSkill.isInstalled && !selectedSkill.isUpdateAvailable
            ? "delete_registry_skill"
            : "install_registry_skill",
        registryId: registryCatalog.registryId,
        skillName: selectedSkill.id,
      });
    },

    handleAddMessageSkillActivation(locationRaw: string) {
      const location = locationRaw.trim();
      if (!location) {
        return;
      }

      deps.setSelectedMessageSkillActivations((current) => {
        if (current.some((selection) => selection.location === location)) {
          return current;
        }

        const skill = deps.availableSkillByLocation.get(location);
        if (!skill) {
          return current;
        }

        return [
          ...current,
          {
            name: skill.name,
            location: skill.location,
          },
        ];
      });
    },

    handleRemoveMessageSkillActivation(locationRaw: string) {
      const location = locationRaw.trim();
      if (!location) {
        return;
      }

      deps.setSelectedMessageSkillActivations((current) =>
        current.filter((selection) => selection.location !== location),
      );
    },

    handleAddThreadSkill(locationRaw: string) {
      const location = locationRaw.trim();
      if (!location) {
        return;
      }

      const skill = deps.availableSkillByLocation.get(location);
      if (!skill) {
        return;
      }

      const activeId = deps.readActiveThreadId().trim();
      if (!activeId) {
        return;
      }

      deps.updateThreadStateById(activeId, (thread) => {
        if (
          thread.skillSelections.some(
            (selection) => selection.location === location,
          )
        ) {
          return thread;
        }

        return {
          ...thread,
          skillSelections: [
            ...thread.skillSelections,
            {
              name: skill.name,
              location: skill.location,
            },
          ],
        };
      });
      deps.setSkillsError(null);
    },

    handleRemoveThreadSkill(locationRaw: string) {
      const location = locationRaw.trim();
      if (!location) {
        return;
      }

      const activeId = deps.readActiveThreadId().trim();
      if (!activeId) {
        return;
      }

      deps.updateThreadStateById(activeId, (thread) => ({
        ...thread,
        skillSelections: thread.skillSelections.filter(
          (selection) => selection.location !== location,
        ),
      }));
      deps.setSkillsError(null);
    },

    handleToggleThreadSkill(locationRaw: string) {
      const location = locationRaw.trim();
      if (!location) {
        return;
      }

      const activeId = deps.readActiveThreadId().trim();
      if (!activeId) {
        return;
      }

      deps.updateThreadStateById(activeId, (thread) => {
        const existingIndex = thread.skillSelections.findIndex(
          (selection) => selection.location === location,
        );
        if (existingIndex >= 0) {
          return {
            ...thread,
            skillSelections: thread.skillSelections.filter(
              (selection) => selection.location !== location,
            ),
          };
        }

        const skill = deps.availableSkillByLocation.get(location);
        if (!skill) {
          return thread;
        }

        return {
          ...thread,
          skillSelections: [
            ...thread.skillSelections,
            {
              name: skill.name,
              location: skill.location,
            },
          ],
        };
      });
      deps.setSkillsError(null);
    },
  };
}

export function createMcpProfileHandlers(
  deps: McpProfileHandlerDependencies,
): McpProfileHandlers {
  return {
    handleReloadWorkspaceMcpServerProfiles() {
      deps.setWorkspaceMcpServerProfileError(null);
      void deps.loadWorkspaceMcpServerProfiles();
    },

    handleCancelMcpServerEdit() {
      deps.clearMcpServerEditState();
      deps.setWorkspaceMcpServerProfileError(null);
    },

    handleEditWorkspaceMcpServerProfile(serverIdRaw: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        deps.setWorkspaceMcpServerProfileError(
          "Archived thread is read-only. Restore it from Archives to edit MCP servers.",
        );
        return;
      }

      const serverId = serverIdRaw.trim();
      if (!serverId) {
        return;
      }

      const selected = deps
        .readWorkspaceMcpServerProfiles()
        .find((server) => server.id === serverId);
      if (!selected) {
        deps.setWorkspaceMcpServerProfileError(
          "Selected MCP server is not available.",
        );
        return;
      }

      deps.setEditingMcpServerId(serverId);
      deps.populateMcpServerFormForEdit(selected);
      deps.setMcpFormError(null);
      deps.setMcpFormWarning(null);
      deps.setWorkspaceMcpServerProfileError(null);
    },

    async handleDeleteWorkspaceMcpServerProfile(serverIdRaw: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        deps.setWorkspaceMcpServerProfileError(
          "Archived thread is read-only. Restore it from Archives to edit MCP servers.",
        );
        return;
      }

      if (deps.isDeletingWorkspaceMcpServerProfile) {
        return;
      }

      const serverId = serverIdRaw.trim();
      if (!serverId) {
        return;
      }

      const selected = deps
        .readWorkspaceMcpServerProfiles()
        .find((server) => server.id === serverId);
      if (!selected) {
        deps.setWorkspaceMcpServerProfileError(
          "Selected MCP server is not available.",
        );
        return;
      }

      deps.setIsDeletingWorkspaceMcpServerProfile(true);
      deps.setWorkspaceMcpServerProfileError(null);

      try {
        const nextWorkspaceMcpServerProfiles =
          await deps.deleteWorkspaceMcpServerProfileFromConfig(serverId);
        deps.applyWorkspaceMcpServerProfiles(nextWorkspaceMcpServerProfiles);

        const deletedKey = buildMcpServerKey(selected);
        const activeId = deps.readActiveThreadId().trim();
        if (activeId) {
          deps.updateThreadStateById(activeId, (thread) => ({
            ...thread,
            mcpServers: thread.mcpServers.filter(
              (server) => buildMcpServerKey(server) !== deletedKey,
            ),
          }));
        }

        if (deps.readEditingMcpServerId().trim() === serverId) {
          deps.clearMcpServerEditState();
        }
      } catch (deleteError) {
        deps.logClientError("delete_mcp_server_failed", deleteError, {
          action: "delete_saved_mcp_server",
          context: {
            serverId,
            serverName: selected.name,
          },
        });
        deps.setWorkspaceMcpServerProfileError(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete MCP server.",
        );
      } finally {
        deps.setIsDeletingWorkspaceMcpServerProfile(false);
      }
    },

    handleToggleWorkspaceMcpServerProfile(serverIdRaw: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        deps.setWorkspaceMcpServerProfileError(
          "Archived thread is read-only. Restore it from Archives to edit MCP servers.",
        );
        return;
      }

      const serverId = serverIdRaw.trim();
      if (!serverId) {
        return;
      }

      const selected = deps
        .readWorkspaceMcpServerProfiles()
        .find((server) => server.id === serverId);
      if (!selected) {
        deps.setWorkspaceMcpServerProfileError(
          "Selected MCP server is not available.",
        );
        return;
      }

      const selectedKey = buildMcpServerKey(selected);
      const activeId = deps.readActiveThreadId().trim();
      if (!activeId) {
        return;
      }

      deps.updateThreadStateById(activeId, (thread) => {
        const alreadyConnected = thread.mcpServers.some(
          (server) => buildMcpServerKey(server) === selectedKey,
        );
        if (alreadyConnected) {
          return {
            ...thread,
            mcpServers: thread.mcpServers.filter(
              (server) => buildMcpServerKey(server) !== selectedKey,
            ),
          };
        }

        return {
          ...thread,
          mcpServers: [...thread.mcpServers, selected],
        };
      });
      deps.setWorkspaceMcpServerProfileError(null);
    },

    handleRemoveMcpServer(id: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      const activeId = deps.readActiveThreadId().trim();
      if (!activeId) {
        return;
      }

      deps.updateThreadStateById(activeId, (thread) => ({
        ...thread,
        mcpServers: thread.mcpServers.filter((server) => server.id !== id),
      }));
    },

    async handleAddMcpServer() {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        deps.setMcpFormError(
          "Archived thread is read-only. Restore it from Archives to edit MCP servers.",
        );
        return;
      }

      const {
        editingMcpServerId,
        mcpNameInput,
        mcpTransport,
        mcpUrlInput,
        mcpCommandInput,
        mcpArgsInput,
        mcpCwdInput,
        mcpEnvInput,
        mcpHeadersInput,
        mcpUseAzureAuthInput,
        mcpAzureAuthScopeInput,
        mcpTimeoutSecondsInput,
      } = deps.mcpFormState;

      const editingServerId = editingMcpServerId.trim();
      const isEditing = editingServerId.length > 0;
      const editingServer = isEditing
        ? (deps
            .readWorkspaceMcpServerProfiles()
            .find((server) => server.id === editingServerId) ?? null)
        : null;
      if (isEditing && !editingServer) {
        deps.setEditingMcpServerId("");
        deps.setMcpFormError("Selected MCP server is not available.");
        return;
      }

      const rawName = mcpNameInput.trim();
      deps.setMcpFormError(null);
      deps.setMcpFormWarning(null);

      let serverToSave: McpServerConfig;
      const serverId = isEditing ? editingServerId : createId("mcp");

      if (mcpTransport === "stdio") {
        const command = mcpCommandInput.trim();
        if (!command) {
          deps.setMcpFormError("MCP stdio command is required.");
          return;
        }

        if (/\s/.test(command)) {
          deps.setMcpFormError("MCP stdio command must not include spaces.");
          return;
        }

        const argsResult = parseStdioArgsInput(mcpArgsInput);
        if (!argsResult.ok) {
          deps.setMcpFormError(argsResult.error);
          return;
        }

        const envResult = parseStdioEnvInput(mcpEnvInput);
        if (!envResult.ok) {
          deps.setMcpFormError(envResult.error);
          return;
        }

        const cwd = mcpCwdInput.trim();
        const name = rawName || command;

        serverToSave = {
          name,
          transport: "stdio",
          command,
          args: argsResult.value,
          cwd: cwd || undefined,
          env: envResult.value,
          id: serverId,
        };
      } else {
        const rawUrl = mcpUrlInput.trim();
        if (!rawUrl) {
          deps.setMcpFormError("MCP server URL is required.");
          return;
        }

        let parsed: URL;
        try {
          parsed = new URL(rawUrl);
        } catch {
          deps.setMcpFormError("MCP server URL is invalid.");
          return;
        }

        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          deps.setMcpFormError(
            "MCP server URL must start with http:// or https://.",
          );
          return;
        }

        const name = rawName || parsed.hostname;
        if (!name) {
          deps.setMcpFormError("MCP server name is required.");
          return;
        }

        const normalizedUrl = parsed.toString();
        const headersResult = parseHttpHeadersInput(mcpHeadersInput);
        if (!headersResult.ok) {
          deps.setMcpFormError(headersResult.error);
          return;
        }

        let azureAuthScope = MCP_DEFAULT_AZURE_AUTH_SCOPE;
        if (mcpUseAzureAuthInput) {
          const scopeResult = parseAzureAuthScopeInput(mcpAzureAuthScopeInput);
          if (!scopeResult.ok) {
            deps.setMcpFormError(scopeResult.error);
            return;
          }
          azureAuthScope = scopeResult.value;
        }
        const timeoutResult = parseMcpTimeoutSecondsInput(
          mcpTimeoutSecondsInput,
        );
        if (!timeoutResult.ok) {
          deps.setMcpFormError(timeoutResult.error);
          return;
        }

        serverToSave = {
          id: serverId,
          name,
          url: normalizedUrl,
          transport: mcpTransport,
          headers: headersResult.value,
          useAzureAuth: mcpUseAzureAuthInput,
          azureAuthScope,
          timeoutSeconds: timeoutResult.value,
        };
      }

      const activeThreadMcpServers = deps.readActiveThreadMcpServers();
      const existingServerIndex = isEditing
        ? -1
        : activeThreadMcpServers.findIndex(
            (server) =>
              buildMcpServerKey(server) === buildMcpServerKey(serverToSave),
          );
      const existingServerName =
        existingServerIndex >= 0
          ? (activeThreadMcpServers[existingServerIndex]?.name ?? "")
          : "";

      deps.setIsSavingMcpServer(true);
      let saveWarning: string | null = null;
      let savedProfile = serverToSave;
      try {
        const saveResult = await deps.saveMcpServerToConfig(serverToSave, {
          isUpdate: isEditing,
        });
        saveWarning = saveResult.warning;
        savedProfile = saveResult.profile;

        if (isEditing && editingServer) {
          const previousServerKey = buildMcpServerKey(editingServer);
          const nextServerKey = buildMcpServerKey(savedProfile);
          const activeId = deps.readActiveThreadId().trim();
          if (activeId) {
            deps.updateThreadStateById(activeId, (thread) => {
              const filtered = thread.mcpServers.filter(
                (server) => buildMcpServerKey(server) !== previousServerKey,
              );
              if (filtered.length === thread.mcpServers.length) {
                return thread;
              }

              const nextIndex = filtered.findIndex(
                (server) => buildMcpServerKey(server) === nextServerKey,
              );
              if (nextIndex >= 0) {
                return {
                  ...thread,
                  mcpServers: filtered.map((server, index) =>
                    index === nextIndex
                      ? { ...server, name: savedProfile.name }
                      : server,
                  ),
                };
              }

              return {
                ...thread,
                mcpServers: [...filtered, savedProfile],
              };
            });
          }
        } else {
          deps.connectMcpServerToAgent(savedProfile);
        }

        deps.setWorkspaceMcpServerProfileError(null);
      } catch (saveError) {
        deps.logClientError("save_mcp_server_failed", saveError, {
          action: "save_mcp_server",
        });
        deps.setMcpFormError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to save MCP server.",
        );
        return;
      } finally {
        deps.setIsSavingMcpServer(false);
      }

      deps.setMcpFormError(null);
      if (isEditing) {
        deps.setMcpFormWarning(saveWarning);
        if (saveWarning) {
          deps.logClientWarning("mcp_server_edit_warning", saveWarning, {
            action: "save_mcp_server",
            context: {
              savedProfileName: savedProfile.name,
              transport: savedProfile.transport,
            },
          });
        }
      } else if (existingServerIndex >= 0) {
        const fallbackLocalWarning =
          existingServerName && existingServerName !== savedProfile.name
            ? `An MCP server with the same configuration already exists. Renamed it from "${existingServerName}" to "${savedProfile.name}".`
            : "An MCP server with the same configuration already exists. Reused the existing entry.";
        const warningToShow = saveWarning ?? fallbackLocalWarning;
        deps.setMcpFormWarning(warningToShow);
        deps.logClientWarning("mcp_server_duplicate_warning", warningToShow, {
          action: "save_mcp_server",
          context: {
            existingServerName,
            savedProfileName: savedProfile.name,
            transport: serverToSave.transport,
          },
        });
      } else {
        deps.setMcpFormWarning(saveWarning);
        if (saveWarning) {
          deps.logClientWarning("mcp_server_save_warning", saveWarning, {
            action: "save_mcp_server",
            context: {
              savedProfileName: savedProfile.name,
              transport: serverToSave.transport,
            },
          });
        }
      }
      deps.setEditingMcpServerId("");
      deps.resetMcpServerFormInputs();
    },
  };
}

export function createInstructionEditingHandlers(
  deps: InstructionEditingHandlerDependencies,
): InstructionEditingHandlers {
  const resetInstructionMutationStatus = () => {
    deps.setInstructionSaveError(null);
    deps.setInstructionSaveSuccess(null);
    deps.setInstructionEnhanceError(null);
    deps.setInstructionEnhanceSuccess(null);
    deps.setInstructionEnhanceComparison(null);
  };

  return {
    handleInstructionContextToggleChange(toggleKey, nextValue) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      deps.setInstructionContextToggles((current) => ({
        ...current,
        [toggleKey]: nextValue,
      }));
      resetInstructionMutationStatus();
    },

    handleAgentInstructionChange(value: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      deps.setAgentInstruction(value);
      resetInstructionMutationStatus();
    },

    handleClearInstruction() {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      deps.setAgentInstruction("");
      deps.setLoadedInstructionFileName(null);
      deps.setInstructionFileError(null);
      resetInstructionMutationStatus();
    },

    async handleInstructionFileChange(
      event: ChangeEvent<HTMLInputElement>,
    ): Promise<void> {
      const input = event.currentTarget;
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        input.value = "";
        return;
      }

      const file = input.files?.[0];
      if (!file) {
        return;
      }

      deps.setInstructionFileError(null);

      const extension = getFileExtension(file.name);
      if (!INSTRUCTION_ALLOWED_EXTENSIONS.has(extension)) {
        deps.setInstructionFileError(
          "Only .md, .txt, .xml, and .json files are supported.",
        );
        input.value = "";
        return;
      }

      if (file.size > INSTRUCTION_MAX_FILE_SIZE_BYTES) {
        deps.setInstructionFileError(
          `Instruction file is too large. Max ${INSTRUCTION_MAX_FILE_SIZE_LABEL}.`,
        );
        input.value = "";
        return;
      }

      try {
        const text = await file.text();
        deps.setAgentInstruction(text);
        deps.setLoadedInstructionFileName(file.name);
        resetInstructionMutationStatus();
      } catch (readInstructionError) {
        deps.logClientError("read_instruction_file_failed", readInstructionError, {
          action: "load_instruction_file",
          context: {
            fileName: file.name,
            fileSize: file.size,
          },
        });
        deps.setInstructionFileError("Failed to read the selected instruction file.");
      } finally {
        input.value = "";
      }
    },
  };
}
