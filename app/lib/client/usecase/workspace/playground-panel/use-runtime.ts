import { useEffect } from "react";
import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import {
  resizeChatComposerInput,
} from "~/lib/client/usecase/workspace/chat-composer/handlers";
import {
  deriveActiveChatCommandMenuState,
  type ChatCommandProvider,
} from "~/lib/client/usecase/workspace/chat-composer/menu-state";
import { clampNumber } from "~/lib/client/usecase/workspace/numbers";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";

type UsePlaygroundRuntimeOptions = {
  messages: ThreadMessage[];
  isSending: boolean;
  sendProgressMessages: string[];
  endOfMessagesRef: MutableRefObject<HTMLDivElement | null>;
  chatInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  pendingChatCommandCursorIndexRef: MutableRefObject<number | null>;
  draft: string;
  chatComposerCursorIndex: number;
  setChatComposerCursorIndex: (value: number) => void;
  chatCommandHighlightedIndex: number;
  setChatCommandHighlightedIndex: Dispatch<SetStateAction<number>>;
  chatCommandProviders: readonly ChatCommandProvider[];
};

export function usePlaygroundRuntime(options: UsePlaygroundRuntimeOptions) {
  const effectiveChatComposerCursorIndex =
    options.chatInputRef.current?.selectionStart ??
    options.chatComposerCursorIndex;
  const {
    activeChatCommandMatch,
    activeChatCommandProvider,
    activeChatCommandSuggestions,
    activeChatCommandHighlightIndex,
    activeChatCommandMenu,
  } = deriveActiveChatCommandMenuState({
    value: options.draft,
    cursorIndex: effectiveChatComposerCursorIndex,
    chatCommandProviders: options.chatCommandProviders,
    highlightedIndex: options.chatCommandHighlightedIndex,
  });

  useEffect(() => {
    options.endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    options.endOfMessagesRef,
    options.isSending,
    options.messages,
    options.sendProgressMessages,
  ]);

  useEffect(() => {
    const input = options.chatInputRef.current;
    if (!input) {
      return;
    }

    resizeChatComposerInput(input);
  }, [options.chatInputRef, options.draft]);

  useEffect(() => {
    const pendingCursorIndex = options.pendingChatCommandCursorIndexRef.current;
    if (pendingCursorIndex === null) {
      return;
    }

    const input = options.chatInputRef.current;
    if (!input) {
      return;
    }

    const nextCursorIndex = clampNumber(
      pendingCursorIndex,
      0,
      options.draft.length,
    );
    input.focus();
    input.setSelectionRange(nextCursorIndex, nextCursorIndex);
    options.pendingChatCommandCursorIndexRef.current = null;
    options.setChatComposerCursorIndex(nextCursorIndex);
  }, [
    options.chatInputRef,
    options.draft,
    options.pendingChatCommandCursorIndexRef,
    options.setChatComposerCursorIndex,
  ]);

  useEffect(() => {
    options.setChatCommandHighlightedIndex(0);
  }, [
    activeChatCommandMatch?.keyword,
    activeChatCommandMatch?.query,
    activeChatCommandMatch?.rangeStart,
    activeChatCommandMatch?.rangeEnd,
    options.setChatCommandHighlightedIndex,
  ]);

  useEffect(() => {
    if (activeChatCommandSuggestions.length === 0) {
      options.setChatCommandHighlightedIndex(0);
      return;
    }

    options.setChatCommandHighlightedIndex((current) =>
      clampNumber(current, 0, activeChatCommandSuggestions.length - 1),
    );
  }, [activeChatCommandSuggestions.length, options.setChatCommandHighlightedIndex]);

  return {
    activeChatCommandMatch,
    activeChatCommandProvider,
    activeChatCommandSuggestions,
    activeChatCommandHighlightIndex,
    activeChatCommandMenu,
  };
}
