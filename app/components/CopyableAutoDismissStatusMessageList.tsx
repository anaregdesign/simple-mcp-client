import { AutoDismissStatusMessageList } from "~/components/shared/AutoDismissStatusMessageList";
import { copyTextToClipboard } from "~/lib/client/infrastructure/browser/clipboard";

type CopyableAutoDismissStatusMessageListProps = Parameters<
  typeof AutoDismissStatusMessageList
>[0];

export function CopyableAutoDismissStatusMessageList(
  props: CopyableAutoDismissStatusMessageListProps,
) {
  return (
    <AutoDismissStatusMessageList
      {...props}
      onCopyText={(text) => {
        void copyTextToClipboard(text).catch(() => {
          /* no-op */
        });
      }}
    />
  );
}
