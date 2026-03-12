/**
 * Client UI component module.
 */
import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  RefObject,
  SyntheticEvent,
} from "react";
import { PlaygroundComposer } from "~/components/playground/PlaygroundComposer";
import { PlaygroundConversation } from "~/components/playground/PlaygroundConversation";
import { PlaygroundHeader } from "~/components/playground/PlaygroundHeader";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type {
  AzureConnectionOptionView,
} from "~/lib/client/usecase/workspace/azure-settings/view-types";
import type {
  DesktopUpdaterActionStateView,
  DesktopUpdaterStatusView,
} from "~/lib/client/usecase/workspace/desktop-updater/view-types";
import type {
  ChatCommandMenuView,
  ThreadMcpConnectionView,
  ThreadMessageAttachmentView,
  ThreadMessageView,
  ThreadOperationLogEntryView,
  ThreadSkillView,
} from "~/lib/client/usecase/workspace/playground-panel/view-types";
import styles from "~/components/playground/PlaygroundPanel.module.css";

type PlaygroundPanelProps<
  TMessage extends ThreadMessageView,
  TThreadOperationLogEntry extends ThreadOperationLogEntryView,
  TMcpServer extends ThreadMcpConnectionView,
> = {
  header: {
    desktopUpdaterStatus: DesktopUpdaterStatusView;
    desktopUpdaterActionState: DesktopUpdaterActionStateView;
    isApplyingDesktopUpdate: boolean;
    onCheckDesktopUpdates: () => void;
    onApplyDesktopUpdate: () => void;
    activeThreadName: string;
    isThreadOperationBusy: boolean;
    isCreatingThread: boolean;
    onCreateThread: () => void;
  };
  conversation: {
    messages: TMessage[];
    threadOperationLogsByTurnId: Map<string, TThreadOperationLogEntry[]>;
    renderMessageContent: (
      message: TMessage,
      onCopyText: (content: string) => void,
    ) => ReactNode;
    renderTurnOperationLog: (
      entries: TThreadOperationLogEntry[],
      isLive: boolean,
      onCopy: (text: string) => void,
    ) => ReactNode;
    onCopyMessage: (content: string) => void;
    onCopyOperationLog: (content: string) => void;
    isSending: boolean;
    sendProgressMessages: string[];
    activeTurnOperationLogs: TThreadOperationLogEntry[];
    errorTurnOperationLogs: TThreadOperationLogEntry[];
    endOfMessagesRef: RefObject<HTMLDivElement | null>;
  };
  composer: {
    systemNotice: string | null;
    onClearSystemNotice: () => void;
    error: string | null;
    azureLoginError: string | null;
    isThreadReadOnly: boolean;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    chatInputRef: RefObject<HTMLTextAreaElement | null>;
    messageAttachmentInputRef: RefObject<HTMLInputElement | null>;
    messageAttachmentAccept: string;
    messageAttachmentFormatHint: string;
    draft: string;
    messageAttachments: ThreadMessageAttachmentView[];
    messageAttachmentError: string | null;
    onDraftChange: (
      event: ChangeEvent<HTMLTextAreaElement>,
      value: string,
    ) => void;
    onInputSelect: (event: SyntheticEvent<HTMLTextAreaElement>) => void;
    onOpenMessageAttachmentPicker: () => void;
    onMessageAttachmentFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onRemoveMessageAttachment: (id: string) => void;
    onInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
    chatCommandMenu: ChatCommandMenuView | null;
    onSelectChatCommandSuggestion: (id: string) => void;
    onHighlightChatCommandSuggestion: (index: number) => void;
    onCompositionStart: () => void;
    onCompositionEnd: () => void;
    isSending: boolean;
    isChatLocked: boolean;
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
    maxMessageAttachmentFiles: number;
    canSendMessage: boolean;
    selectedThreadSkills: ThreadSkillView[];
    selectedMessageSkillActivations: ThreadSkillView[];
    onRemoveThreadSkill: (location: string) => void;
    onRemoveMessageSkillActivation: (location: string) => void;
    mcpServers: TMcpServer[];
    onRemoveMcpServer: (id: string) => void;
    onCancelThreadProcessing: () => void;
  };
};

export function PlaygroundPanel<
  TMessage extends ThreadMessageView,
  TThreadOperationLogEntry extends ThreadOperationLogEntryView,
  TMcpServer extends ThreadMcpConnectionView,
>(props: PlaygroundPanelProps<TMessage, TThreadOperationLogEntry, TMcpServer>) {
  const {
    header,
    conversation,
    composer,
  } = props;

  return (
    <section className={styles.root} aria-label="Playground">
      <PlaygroundHeader {...header} />
      <PlaygroundConversation
        {...conversation}
      />
      <PlaygroundComposer
        {...composer}
      />
    </section>
  );
}
