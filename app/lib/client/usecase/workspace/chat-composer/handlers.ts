import type {
  ChangeEvent,
  Dispatch,
  FormEvent,
  KeyboardEvent,
  SetStateAction,
  SyntheticEvent,
} from "react";
import type { DraftChatAttachment } from "~/lib/contracts/chat/attachments";
import {
  formatChatAttachmentSize,
} from "~/lib/client/usecase/workspace/chat-composer/attachment-size";
import {
  replaceChatCommandToken,
  type ChatCommandMatch,
} from "~/lib/client/usecase/workspace/chat-composer/commands";
import {
  type ChatCommandProvider,
} from "~/lib/client/usecase/workspace/chat-composer/menu-state";
import { readFileAsDataUrl } from "~/lib/client/infrastructure/browser/file-data-url";
import { createId } from "~/lib/client/usecase/workspace/ids";
import type {
  ChatCommandSuggestion,
} from "~/lib/client/usecase/workspace/skills-catalog/selectors";
import type {
  ChatCommandMenuView,
  MainViewTab,
} from "~/lib/client/usecase/workspace/view-types";
import { getFileExtension } from "~/lib/client/usecase/workspace/files";
import {
  CHAT_ATTACHMENT_ALLOWED_EXTENSIONS,
  CHAT_ATTACHMENT_MAX_FILES,
  CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH,
  CHAT_ATTACHMENT_MAX_NON_PDF_FILE_SIZE_BYTES,
  CHAT_ATTACHMENT_MAX_PDF_FILE_SIZE_BYTES,
  CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES,
  CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES,
} from "~/lib/constants/chat";
import {
  CLIENT_CHAT_INPUT_MAX_HEIGHT_PX,
  CLIENT_CHAT_INPUT_MIN_HEIGHT_PX,
} from "~/lib/constants/client";

type ChatComposerLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type ChatComposerHandlerDependencies = {
  isArchivedThread: (threadIdRaw: string) => boolean;
  readActiveThreadId: () => string;
  isChatLocked: boolean;
  isSending: boolean;
  isComposing: boolean;
  readDraft: () => string;
  readDraftAttachments: () => DraftChatAttachment[];
  readDraftAttachmentTotalSizeBytes: () => number;
  readDraftPdfAttachmentTotalSizeBytes: () => number;
  chatAttachmentFormatHint: string;
  readActiveChatCommandMatch: () => ChatCommandMatch | null;
  readActiveChatCommandProvider: () => ChatCommandProvider | null;
  readActiveChatCommandSuggestions: () => ChatCommandSuggestion[];
  readActiveChatCommandMenu: () => ChatCommandMenuView | null;
  readActiveChatCommandHighlightIndex: () => number;
  readChatAttachmentInput: () => HTMLInputElement | null;
  setPendingChatCommandCursorIndex: (value: number | null) => void;
  setDraft: (value: string) => void;
  setChatComposerCursorIndex: (value: number) => void;
  setChatCommandHighlightedIndex: Dispatch<SetStateAction<number>>;
  setChatAttachmentError: (value: string | null) => void;
  setDraftAttachments: Dispatch<SetStateAction<DraftChatAttachment[]>>;
  setThreadError: (message: string | null) => void;
  setActiveMainTab: (tab: MainViewTab) => void;
  sendMessage: () => Promise<void>;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: ChatComposerLogOptions,
  ) => void;
};

export type ChatComposerHandlers = {
  handleSelectActiveChatCommandSuggestion: (suggestionIdRaw: string) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleDraftChange: (
    event: ChangeEvent<HTMLTextAreaElement>,
    value: string,
  ) => void;
  handleInputSelect: (event: SyntheticEvent<HTMLTextAreaElement>) => void;
  handleOpenChatAttachmentPicker: () => void;
  handleChatAttachmentFileChange: (
    event: ChangeEvent<HTMLInputElement>,
  ) => Promise<void>;
  handleRemoveDraftAttachment: (id: string) => void;
};

export function createChatComposerHandlers(
  deps: ChatComposerHandlerDependencies,
): ChatComposerHandlers {
  function handleSelectActiveChatCommandSuggestion(suggestionIdRaw: string) {
      const suggestionId = suggestionIdRaw.trim();
      const activeChatCommandMatch = deps.readActiveChatCommandMatch();
      const activeChatCommandProvider = deps.readActiveChatCommandProvider();
      if (
        !suggestionId ||
        !activeChatCommandMatch ||
        !activeChatCommandProvider
      ) {
        return;
      }

      const suggestion =
        deps
          .readActiveChatCommandSuggestions()
          .find((entry) => entry.id === suggestionId) ?? null;
      if (!suggestion || !suggestion.isAvailable) {
        return;
      }

      activeChatCommandProvider.applySuggestion(suggestion);

      const nextDraft = replaceChatCommandToken({
        value: deps.readDraft(),
        rangeStart: activeChatCommandMatch.rangeStart,
        rangeEnd: activeChatCommandMatch.rangeEnd,
        replacement: "",
      });
      deps.setPendingChatCommandCursorIndex(nextDraft.cursorIndex);
      deps.setDraft(nextDraft.value);
      deps.setChatComposerCursorIndex(nextDraft.cursorIndex);
      deps.setChatCommandHighlightedIndex(0);
      deps.setChatAttachmentError(null);
  }

  return {
    handleSelectActiveChatCommandSuggestion,

    handleSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        deps.setThreadError(
          "Archived thread is read-only. Restore it from Archives to continue.",
        );
        deps.setActiveMainTab("threads");
        return;
      }
      if (deps.isChatLocked) {
        deps.setActiveMainTab("settings");
        return;
      }
      void deps.sendMessage();
    },

    handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
      if (
        event.nativeEvent.isComposing ||
        deps.isComposing ||
        event.nativeEvent.keyCode === 229
      ) {
        return;
      }

      const activeChatCommandMenu = deps.readActiveChatCommandMenu();
      if (activeChatCommandMenu && activeChatCommandMenu.suggestions.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          deps.setChatCommandHighlightedIndex((current) => {
            const total = activeChatCommandMenu.suggestions.length;
            if (total <= 0) {
              return 0;
            }

            return (current + 1) % total;
          });
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          deps.setChatCommandHighlightedIndex((current) => {
            const total = activeChatCommandMenu.suggestions.length;
            if (total <= 0) {
              return 0;
            }

            return (current - 1 + total) % total;
          });
          return;
        }

        if (event.key === "Enter" && !event.shiftKey) {
          const activeSuggestion =
            activeChatCommandMenu.suggestions[
              deps.readActiveChatCommandHighlightIndex()
            ];
          if (!activeSuggestion) {
            return;
          }

          event.preventDefault();
          handleSelectActiveChatCommandSuggestion(activeSuggestion.id);
          return;
        }
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (deps.isArchivedThread(deps.readActiveThreadId())) {
          deps.setThreadError(
            "Archived thread is read-only. Restore it from Archives to continue.",
          );
          deps.setActiveMainTab("threads");
          return;
        }
        if (deps.isChatLocked) {
          deps.setActiveMainTab("settings");
          return;
        }
        void deps.sendMessage();
      }
    },

    handleDraftChange(event: ChangeEvent<HTMLTextAreaElement>, value: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      const cursorIndex = event.currentTarget.selectionStart ?? value.length;
      deps.setDraft(value);
      deps.setChatComposerCursorIndex(cursorIndex);
      deps.setChatAttachmentError(null);
      resizeChatComposerInput(event.currentTarget);
    },

    handleInputSelect(event: SyntheticEvent<HTMLTextAreaElement>) {
      const target = event.currentTarget;
      deps.setChatComposerCursorIndex(target.selectionStart ?? target.value.length);
    },

    handleOpenChatAttachmentPicker() {
      if (
        deps.isSending ||
        deps.isChatLocked ||
        deps.isArchivedThread(deps.readActiveThreadId())
      ) {
        return;
      }

      deps.readChatAttachmentInput()?.click();
    },

    async handleChatAttachmentFileChange(
      event: ChangeEvent<HTMLInputElement>,
    ) {
      const input = event.currentTarget;
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        input.value = "";
        return;
      }
      const selectedFiles = input.files ? Array.from(input.files) : [];
      if (selectedFiles.length === 0) {
        input.value = "";
        return;
      }

      deps.setChatAttachmentError(null);

      const availableSlots =
        CHAT_ATTACHMENT_MAX_FILES - deps.readDraftAttachments().length;
      if (availableSlots <= 0) {
        deps.setChatAttachmentError(
          `You can attach up to ${CHAT_ATTACHMENT_MAX_FILES} files.`,
        );
        input.value = "";
        return;
      }

      const filesToProcess = selectedFiles.slice(0, availableSlots);
      const nextAttachments: DraftChatAttachment[] = [];
      let nextTotalSize = deps.readDraftAttachmentTotalSizeBytes();
      let nextPdfTotalSize = deps.readDraftPdfAttachmentTotalSizeBytes();
      let validationError: string | null = null;

      for (const file of filesToProcess) {
        const normalizedName = file.name.trim() || "attachment";
        if (normalizedName.length > CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH) {
          validationError = `Attachment file names must be ${CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH} characters or fewer.`;
          break;
        }

        const extension = getFileExtension(normalizedName);
        if (!CHAT_ATTACHMENT_ALLOWED_EXTENSIONS.has(extension)) {
          validationError = `Attachment "${normalizedName}" is not supported. Only ${deps.chatAttachmentFormatHint} files can be attached.`;
          break;
        }

        const normalizedMimeType = file.type.trim().toLowerCase();

        if (file.size <= 0) {
          validationError = `Attachment "${normalizedName}" is empty.`;
          break;
        }

        const maxFileSizeBytes =
          extension === "pdf"
            ? CHAT_ATTACHMENT_MAX_PDF_FILE_SIZE_BYTES
            : CHAT_ATTACHMENT_MAX_NON_PDF_FILE_SIZE_BYTES;
        if (file.size > maxFileSizeBytes) {
          validationError = `Attachment "${normalizedName}" is too large. Max size is ${formatChatAttachmentSize(maxFileSizeBytes)} for .${extension} files.`;
          break;
        }

        if (nextTotalSize + file.size > CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES) {
          validationError = `Total attachment size cannot exceed ${formatChatAttachmentSize(CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES)}.`;
          break;
        }
        if (
          extension === "pdf" &&
          nextPdfTotalSize + file.size > CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES
        ) {
          validationError = `Total PDF attachment size cannot exceed ${formatChatAttachmentSize(CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES)}.`;
          break;
        }

        try {
          const dataUrl = await readFileAsDataUrl(file);
          nextAttachments.push({
            id: createId("attachment"),
            name: normalizedName,
            mimeType: normalizedMimeType || "application/octet-stream",
            sizeBytes: file.size,
            dataUrl,
          });
          nextTotalSize += file.size;
          if (extension === "pdf") {
            nextPdfTotalSize += file.size;
          }
        } catch (readAttachmentError) {
          deps.logClientError("read_attachment_failed", readAttachmentError, {
            action: "read_chat_attachment",
            context: {
              fileName: normalizedName,
              fileSize: file.size,
            },
          });
          validationError = `Failed to read "${normalizedName}".`;
          break;
        }
      }

      if (!validationError && selectedFiles.length > filesToProcess.length) {
        validationError = `You can attach up to ${CHAT_ATTACHMENT_MAX_FILES} files.`;
      }

      if (nextAttachments.length > 0) {
        deps.setDraftAttachments((current) => [...current, ...nextAttachments]);
      }

      deps.setChatAttachmentError(validationError);
      input.value = "";
    },

    handleRemoveDraftAttachment(id: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      deps.setDraftAttachments((current) =>
        current.filter((attachment) => attachment.id !== id),
      );
      deps.setChatAttachmentError(null);
    },
  };
}

export function resizeChatComposerInput(input: HTMLTextAreaElement) {
  input.style.height = "auto";
  const boundedHeight = Math.max(
    CLIENT_CHAT_INPUT_MIN_HEIGHT_PX,
    Math.min(input.scrollHeight, CLIENT_CHAT_INPUT_MAX_HEIGHT_PX),
  );
  input.style.height = `${boundedHeight}px`;
  input.style.overflowY =
    input.scrollHeight > CLIENT_CHAT_INPUT_MAX_HEIGHT_PX ? "auto" : "hidden";
}
