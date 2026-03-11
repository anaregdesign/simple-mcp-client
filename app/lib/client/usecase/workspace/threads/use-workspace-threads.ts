import {
  useWorkspaceThreadBackgroundEffects,
} from "~/lib/client/usecase/workspace/threads/background-effects";
import {
  createThreadLifecycleHandlers,
} from "~/lib/client/usecase/workspace/threads/thread-lifecycle-handlers";
import {
  createThreadTitleController,
} from "~/lib/client/usecase/workspace/threads/thread-title-controller";
import {
  createSendMessageController,
} from "~/lib/client/usecase/workspace/chat-session/controller";

type ThreadTitleControllerOptions = Parameters<
  typeof createThreadTitleController
>[0];
type SendMessageControllerOptions = Omit<
  Parameters<typeof createSendMessageController>[0],
  "refreshThreadTitleInBackground"
>;
type ThreadLifecycleHandlerDependencies = Parameters<
  typeof createThreadLifecycleHandlers
>[0];
type WorkspaceThreadBackgroundEffectsOptions = Omit<
  Parameters<typeof useWorkspaceThreadBackgroundEffects>[0],
  "refreshThreadTitleInBackground"
>;

type UseWorkspaceThreadsOptions = {
  title: ThreadTitleControllerOptions;
  sending: SendMessageControllerOptions;
  lifecycle: ThreadLifecycleHandlerDependencies;
  backgroundEffects: WorkspaceThreadBackgroundEffectsOptions;
};

export function useWorkspaceThreads(options: UseWorkspaceThreadsOptions) {
  const threadTitleController = createThreadTitleController(options.title);

  async function refreshThreadTitleInBackground(request: {
    threadId: string;
    reason:
      | "first_message"
      | "instruction_update"
      | "utility_deployment_update";
    instructionOverride?: string;
  }): Promise<void> {
    await threadTitleController.refreshThreadTitleInBackground(request);
  }

  const sendMessageController = createSendMessageController({
    ...options.sending,
    refreshThreadTitleInBackground,
  });

  async function sendMessage(): Promise<void> {
    await sendMessageController.sendMessage();
  }

  useWorkspaceThreadBackgroundEffects({
    ...options.backgroundEffects,
    refreshThreadTitleInBackground,
  });

  return {
    ...createThreadLifecycleHandlers(options.lifecycle),
    refreshThreadTitleInBackground,
    sendMessage,
  };
}

export type WorkspaceThreadsController = ReturnType<
  typeof useWorkspaceThreads
>;
