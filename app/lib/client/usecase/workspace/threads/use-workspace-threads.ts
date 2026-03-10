import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import {
  connectThreadMcpServer,
} from "~/lib/domain/policies/thread-mcp-server-membership";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";
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
  readActiveThreadId: () => string;
  updateThreadStateById: (
    threadId: string,
    updater: (thread: ThreadState) => ThreadState,
  ) => void;
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

  function connectMcpServerToActiveThread(serverToConnect: McpServerConfig) {
    const activeThreadId = options.readActiveThreadId().trim();
    if (!activeThreadId) {
      return;
    }

    options.updateThreadStateById(activeThreadId, (thread) => ({
      ...thread,
      mcpServers: connectThreadMcpServer(thread.mcpServers, serverToConnect),
    }));
  }

  return {
    ...createThreadLifecycleHandlers(options.lifecycle),
    refreshThreadTitleInBackground,
    sendMessage,
    connectMcpServerToActiveThread,
  };
}
