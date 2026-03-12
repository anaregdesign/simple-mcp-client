import { clsx } from "clsx";
import type { ChatCommandMenuView } from "~/lib/client/usecase/workspace/playground-panel/view-types";
import styles from "~/components/playground/PlaygroundChatCommandMenu.module.css";

type PlaygroundChatCommandMenuProps = {
  chatCommandMenu: ChatCommandMenuView | null;
  chatCommandListboxId: string;
  onSelectChatCommandSuggestion: (id: string) => void;
  onHighlightChatCommandSuggestion: (index: number) => void;
};

export function PlaygroundChatCommandMenu({
  chatCommandMenu,
  chatCommandListboxId,
  onSelectChatCommandSuggestion,
  onHighlightChatCommandSuggestion,
}: PlaygroundChatCommandMenuProps) {
  if (!chatCommandMenu) {
    return null;
  }

  if (chatCommandMenu.suggestions.length === 0) {
    return (
      <section
        className={styles.menu}
        aria-label={`Command suggestions for ${chatCommandMenu.keyword}`}
      >
        <p className={styles.empty} role="status">
          {chatCommandMenu.emptyHint}
        </p>
      </section>
    );
  }

  return (
    <section
      className={styles.menu}
      aria-label={`Command suggestions for ${chatCommandMenu.keyword}`}
    >
      <ul
        id={chatCommandListboxId}
        className={styles.list}
        role="listbox"
        aria-label={`Command suggestions for ${chatCommandMenu.keyword}`}
      >
        {chatCommandMenu.suggestions.map((suggestion, index) => {
          const isHighlighted = index === chatCommandMenu.highlightedIndex;
          const isUnavailable = !suggestion.isAvailable;

          return (
            <li
              key={`${chatCommandMenu.keyword}:${suggestion.id}`}
              id={`chat-command-option-${index}`}
              role="option"
              aria-selected={isHighlighted}
              className={styles.option}
            >
              <button
                type="button"
                className={clsx(styles.item, isHighlighted && styles.itemHighlighted)}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onMouseEnter={() => {
                  onHighlightChatCommandSuggestion(index);
                }}
                onClick={() => {
                  onSelectChatCommandSuggestion(suggestion.id);
                }}
                disabled={isUnavailable}
              >
                <span className={styles.titleRow}>
                  <span className={styles.label}>
                    {suggestion.label}
                  </span>
                  {suggestion.isSelected ? (
                    <span className={styles.state}>Added</span>
                  ) : null}
                  {isUnavailable ? (
                    <span className={clsx(styles.state, styles.stateUnavailable)}>
                      Unavailable
                    </span>
                  ) : null}
                </span>
                <span className={styles.description}>
                  {suggestion.description}
                </span>
                <span className={styles.detail}>
                  {suggestion.detail}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
