import { CHAT_ATTACHMENT_MAX_FILES } from "~/lib/constants/chat";
import {
  buildPlaygroundPanelProps,
} from "~/lib/client/usecase/workspace/playground-panel/selectors";

type PlaygroundPanelPropsOptions = Parameters<typeof buildPlaygroundPanelProps>[0];

type BuildWorkspacePlaygroundPanelPropsOptions = Omit<
  PlaygroundPanelPropsOptions,
  | "onCheckDesktopUpdates"
  | "onApplyDesktopUpdate"
  | "onCreateThread"
  | "onCancelThreadProcessing"
  | "onClearSystemNotice"
  | "onCompositionStart"
  | "onCompositionEnd"
  | "maxMessageAttachmentFiles"
> & {
  handleCheckDesktopUpdates: () => Promise<void> | void;
  handleApplyDesktopUpdate: () => Promise<void> | void;
  handleCreateThread: () => Promise<void> | void;
  handleThreadCancel: (threadId: string) => void;
  readActiveThreadId: () => string;
  setSystemNotice: (value: string | null) => void;
  setIsComposing: (value: boolean) => void;
};

export function buildWorkspacePlaygroundPanelProps(
  options: BuildWorkspacePlaygroundPanelPropsOptions,
) {
  const {
    handleCheckDesktopUpdates,
    handleApplyDesktopUpdate,
    handleCreateThread,
    handleThreadCancel,
    readActiveThreadId,
    setSystemNotice,
    setIsComposing,
    ...panelOptions
  } = options;

  return buildPlaygroundPanelProps({
    ...panelOptions,
    onCheckDesktopUpdates: () => {
      void handleCheckDesktopUpdates();
    },
    onApplyDesktopUpdate: () => {
      void handleApplyDesktopUpdate();
    },
    onCreateThread: () => {
      void handleCreateThread();
    },
    onCancelThreadProcessing: () => {
      handleThreadCancel(readActiveThreadId());
    },
    onClearSystemNotice: () => {
      setSystemNotice(null);
    },
    onCompositionStart: () => {
      setIsComposing(true);
    },
    onCompositionEnd: () => {
      setIsComposing(false);
    },
    maxMessageAttachmentFiles: CHAT_ATTACHMENT_MAX_FILES,
  });
}
