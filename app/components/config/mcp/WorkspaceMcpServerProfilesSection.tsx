/**
 * Client UI component module.
 */
import { FluentUI } from "~/components/shared/fluent";
import { ConfigSection } from "~/components/shared/ConfigSection";
import { CopyableStatusMessageList } from "~/components/CopyableStatusMessageList";
import { SelectableCardList } from "~/components/shared/SelectableCardList";
import configStyles from "~/components/shared/ConfigSection.module.css";
import type { ContextActionMenuItem } from "~/components/shared/ContextActionMenu";
import selectableStyles from "~/components/shared/SelectableCardList.module.css";
import type { WorkspaceMcpServerProfileOption } from "~/lib/client/usecase/workspace/mcp-profiles/selectors";
import styles from "~/components/config/mcp/WorkspaceMcpServerProfilesSection.module.css";

const { Button, Spinner } = FluentUI;

/**
 * Props for rendering saved MCP profiles that can be attached/detached from the active thread.
 */
export type WorkspaceMcpServerProfilesSectionProps = {
  workspaceMcpServerProfileOptions: WorkspaceMcpServerProfileOption[];
  selectedWorkspaceMcpServerProfileCount: number;
  isSending: boolean;
  isThreadReadOnly: boolean;
  isLoadingWorkspaceMcpServerProfiles: boolean;
  isMutatingWorkspaceMcpServerProfiles: boolean;
  workspaceMcpServerProfileError: string | null;
  onToggleWorkspaceMcpServerProfile: (id: string) => void;
  onEditWorkspaceMcpServerProfile: (id: string) => void;
  onDeleteWorkspaceMcpServerProfile: (id: string) => void;
  onReloadWorkspaceMcpServerProfiles: () => void;
};

/**
 * Section responsible for listing persisted MCP profiles and connecting them to the current thread.
 */
export function WorkspaceMcpServerProfilesSection(props: WorkspaceMcpServerProfilesSectionProps) {
  const {
    workspaceMcpServerProfileOptions,
    selectedWorkspaceMcpServerProfileCount,
    isSending,
    isThreadReadOnly,
    isLoadingWorkspaceMcpServerProfiles,
    isMutatingWorkspaceMcpServerProfiles,
    workspaceMcpServerProfileError,
    onToggleWorkspaceMcpServerProfile,
    onEditWorkspaceMcpServerProfile,
    onDeleteWorkspaceMcpServerProfile,
    onReloadWorkspaceMcpServerProfiles,
  } = props;

  return (
    <ConfigSection
      className={styles.root}
      title="MCP Servers 🧩"
      description="Add saved MCP profiles to the current thread."
    >
      {isThreadReadOnly ? (
        <p className={configStyles.fieldHint}>
          This thread is archived and read-only. Restore it from Archives to edit MCP servers.
        </p>
      ) : null}
      <div className={selectableStyles.headerRow}>
        <p className={selectableStyles.count}>Added: {selectedWorkspaceMcpServerProfileCount}</p>
        <Button
          type="button"
          appearance="subtle"
          size="small"
          className={selectableStyles.reloadButton}
          title="Reload saved MCP servers."
          aria-label="Reload saved MCP servers"
          onClick={onReloadWorkspaceMcpServerProfiles}
          disabled={isSending || isLoadingWorkspaceMcpServerProfiles || isMutatingWorkspaceMcpServerProfiles}
        >
          ↻ Reload
        </Button>
      </div>
      {isLoadingWorkspaceMcpServerProfiles ? (
        <div className={configStyles.loadingNotice} role="status" aria-live="polite">
          <Spinner size="tiny" />
          Loading MCP Servers...
        </div>
      ) : null}
      <SelectableCardList
        items={workspaceMcpServerProfileOptions}
        listAriaLabel="Saved MCP Servers"
        emptyHint="No saved MCP servers."
        isActionDisabled={isSending || isThreadReadOnly || isMutatingWorkspaceMcpServerProfiles}
        onToggleItem={onToggleWorkspaceMcpServerProfile}
        buildContextMenuItems={(item) => {
          const itemName = item.name.trim() || "MCP server";
          const isContextActionDisabled =
            isSending || isThreadReadOnly || isMutatingWorkspaceMcpServerProfiles;
          const contextMenuItems: ContextActionMenuItem[] = [
            {
              id: "edit",
              label: "Edit",
              title: `Edit ${itemName}`,
              disabled: isContextActionDisabled,
              onSelect: () => {
                onEditWorkspaceMcpServerProfile(item.id);
              },
            },
            {
              id: "delete",
              label: "Delete",
              title: `Delete ${itemName}`,
              intent: "danger",
              disabled: isContextActionDisabled,
              onSelect: () => {
                onDeleteWorkspaceMcpServerProfile(item.id);
              },
            },
          ];
          return contextMenuItems;
        }}
      />
      <CopyableStatusMessageList messages={[{ intent: "error", text: workspaceMcpServerProfileError }]} />
    </ConfigSection>
  );
}
