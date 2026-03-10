import {
  readChatCommandMatchAtCursor,
  type ChatCommandMatch,
} from "~/lib/client/usecase/workspace/chat-composer/commands";
import { clampNumber } from "~/lib/client/usecase/workspace/numbers";
import type {
  ChatCommandSuggestion,
} from "~/lib/client/usecase/workspace/skills-catalog/selectors";
import type { ChatCommandMenuView } from "~/lib/client/usecase/workspace/view-types";

export type ChatCommandProvider = {
  keyword: string;
  emptyHint: string;
  readSuggestions: (query: string) => ChatCommandSuggestion[];
  applySuggestion: (suggestion: ChatCommandSuggestion) => void;
};

type DeriveActiveChatCommandMenuStateOptions = {
  value: string;
  cursorIndex: number;
  chatCommandProviders: readonly ChatCommandProvider[];
  highlightedIndex: number;
};

export function deriveActiveChatCommandMenuState(
  options: DeriveActiveChatCommandMenuStateOptions,
): {
  activeChatCommandMatch: ChatCommandMatch | null;
  activeChatCommandProvider: ChatCommandProvider | null;
  activeChatCommandSuggestions: ChatCommandSuggestion[];
  activeChatCommandHighlightIndex: number;
  activeChatCommandMenu: ChatCommandMenuView | null;
} {
  const chatCommandKeywords = options.chatCommandProviders.map(
    (provider) => provider.keyword,
  );
  const activeChatCommandMatch = readChatCommandMatchAtCursor({
    value: options.value,
    cursorIndex: options.cursorIndex,
    keywords: chatCommandKeywords,
  });
  const activeChatCommandProvider = activeChatCommandMatch
    ? (options.chatCommandProviders.find(
        (provider) => provider.keyword === activeChatCommandMatch.keyword,
      ) ?? null)
    : null;
  const activeChatCommandSuggestions =
    activeChatCommandMatch && activeChatCommandProvider
      ? activeChatCommandProvider.readSuggestions(activeChatCommandMatch.query)
      : [];
  const activeChatCommandHighlightIndex =
    activeChatCommandSuggestions.length > 0
      ? clampNumber(
          options.highlightedIndex,
          0,
          activeChatCommandSuggestions.length - 1,
        )
      : 0;
  const activeChatCommandMenu =
    activeChatCommandMatch && activeChatCommandProvider
      ? {
          keyword: activeChatCommandMatch.keyword,
          query: activeChatCommandMatch.query,
          emptyHint: activeChatCommandProvider.emptyHint,
          highlightedIndex: activeChatCommandHighlightIndex,
          suggestions: activeChatCommandSuggestions,
        }
      : null;

  return {
    activeChatCommandMatch,
    activeChatCommandProvider,
    activeChatCommandSuggestions,
    activeChatCommandHighlightIndex,
    activeChatCommandMenu,
  };
}
