import type { ChatCommandMenuView } from "~/lib/client/usecase/workspace/playground-panel/view-types";

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
        className="chat-command-menu"
        aria-label={`Command suggestions for ${chatCommandMenu.keyword}`}
      >
        <p className="chat-command-empty" role="status">
          {chatCommandMenu.emptyHint}
        </p>
      </section>
    );
  }

  return (
    <section
      className="chat-command-menu"
      aria-label={`Command suggestions for ${chatCommandMenu.keyword}`}
    >
      <ul
        id={chatCommandListboxId}
        className="chat-command-list"
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
              className="chat-command-option"
            >
              <button
                type="button"
                className={`chat-command-item${isHighlighted ? " is-highlighted" : ""}`}
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
                <span className="chat-command-item-title-row">
                  <span className="chat-command-item-label">
                    {suggestion.label}
                  </span>
                  {suggestion.isSelected ? (
                    <span className="chat-command-item-state">Added</span>
                  ) : null}
                  {isUnavailable ? (
                    <span className="chat-command-item-state chat-command-item-state-unavailable">
                      Unavailable
                    </span>
                  ) : null}
                </span>
                <span className="chat-command-item-description">
                  {suggestion.description}
                </span>
                <span className="chat-command-item-detail">
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
