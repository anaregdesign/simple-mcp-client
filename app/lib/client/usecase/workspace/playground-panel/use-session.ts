import {
  useRef,
  useState,
} from "react";
import {
  DEFAULT_REASONING_EFFORT,
  DEFAULT_WEB_SEARCH_ENABLED,
} from "~/lib/constants/chat";
import type { DraftChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadState } from "~/lib/contracts/threads/types";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import type {
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";

export function usePlaygroundSession() {
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingChatCommandCursorIndexRef = useRef<number | null>(null);
  const chatAttachmentInputRef = useRef<HTMLInputElement | null>(null);

  const [draft, setDraft] = useState("");
  const [chatComposerCursorIndex, setChatComposerCursorIndex] = useState(0);
  const [chatCommandHighlightedIndex, setChatCommandHighlightedIndex] =
    useState(0);
  const [draftAttachments, setDraftAttachments] = useState<
    DraftChatAttachment[]
  >([]);
  const [chatAttachmentError, setChatAttachmentError] = useState<string | null>(
    null,
  );
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    DEFAULT_REASONING_EFFORT,
  );
  const [webSearchEnabled, setWebSearchEnabled] = useState(
    DEFAULT_WEB_SEARCH_ENABLED,
  );
  const [isComposing, setIsComposing] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const [selectedMessageSkillActivations, setSelectedMessageSkillActivations] =
    useState<ThreadSkillActivation[]>([]);

  function resetPlaygroundSession() {
    setSelectedMessageSkillActivations([]);
    setReasoningEffort(DEFAULT_REASONING_EFFORT);
    setWebSearchEnabled(DEFAULT_WEB_SEARCH_ENABLED);
    setDraft("");
    setDraftAttachments([]);
    setChatAttachmentError(null);
    setUiError(null);
    setSystemNotice(null);
    setIsComposing(false);
  }

  function applyThreadPlaygroundState(
    thread: Pick<ThreadState, "reasoningEffort" | "webSearchEnabled">,
  ) {
    setSelectedMessageSkillActivations([]);
    setReasoningEffort(thread.reasoningEffort);
    setWebSearchEnabled(thread.webSearchEnabled);
    setDraft("");
    setDraftAttachments([]);
    setChatAttachmentError(null);
    setUiError(null);
    setSystemNotice(null);
    setIsComposing(false);
  }

  return {
    endOfMessagesRef,
    chatInputRef,
    pendingChatCommandCursorIndexRef,
    chatAttachmentInputRef,
    draft,
    setDraft,
    chatComposerCursorIndex,
    setChatComposerCursorIndex,
    chatCommandHighlightedIndex,
    setChatCommandHighlightedIndex,
    draftAttachments,
    setDraftAttachments,
    chatAttachmentError,
    setChatAttachmentError,
    reasoningEffort,
    setReasoningEffort,
    webSearchEnabled,
    setWebSearchEnabled,
    isComposing,
    setIsComposing,
    uiError,
    setUiError,
    systemNotice,
    setSystemNotice,
    selectedMessageSkillActivations,
    setSelectedMessageSkillActivations,
    resetPlaygroundSession,
    applyThreadPlaygroundState,
  };
}
