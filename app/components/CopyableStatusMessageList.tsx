import {
  StatusMessageList,
  type StatusMessage,
} from "~/components/shared/StatusMessageList";
import { copyTextToClipboard } from "~/lib/client/infrastructure/browser/clipboard";

type CopyableStatusMessageListProps = {
  className?: string;
  messages: StatusMessage[];
};

export function CopyableStatusMessageList(
  props: CopyableStatusMessageListProps,
) {
  return (
    <StatusMessageList
      {...props}
      onCopyText={(text) => {
        void copyTextToClipboard(text).catch(() => {
          /* no-op */
        });
      }}
    />
  );
}
