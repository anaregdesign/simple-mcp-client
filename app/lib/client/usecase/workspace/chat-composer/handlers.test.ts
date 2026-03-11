import type { ChangeEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DraftChatAttachment } from "~/lib/contracts/chat/attachments";
import {
  createChatComposerHandlers,
} from "~/lib/client/usecase/workspace/chat-composer/handlers";
import type {
  ChatCommandProvider,
} from "~/lib/client/usecase/workspace/chat-composer/menu-state";

function createBaseDependencies(
  overrides: Partial<
    Parameters<typeof createChatComposerHandlers>[0]
  > = {},
): Parameters<typeof createChatComposerHandlers>[0] {
  const activeChatCommandProvider: ChatCommandProvider = {
    keyword: "$",
    emptyHint: "No matching Skills.",
    readSuggestions: () => [],
    applySuggestion: () => {},
  };

  return {
    isArchivedThread: () => false,
    readActiveThreadId: () => "thread-1",
    isChatLocked: false,
    isSending: false,
    isComposing: false,
    readDraft: () => "",
    readDraftAttachments: () => [],
    readDraftAttachmentTotalSizeBytes: () => 0,
    readDraftPdfAttachmentTotalSizeBytes: () => 0,
    chatAttachmentFormatHint: ".md, .txt",
    readActiveChatCommandMatch: () => null,
    readActiveChatCommandProvider: () => activeChatCommandProvider,
    readActiveChatCommandSuggestions: () => [],
    readActiveChatCommandMenu: () => null,
    readActiveChatCommandHighlightIndex: () => 0,
    readChatAttachmentInput: () => null,
    setPendingChatCommandCursorIndex: () => {},
    setDraft: () => {},
    setChatComposerCursorIndex: () => {},
    setChatCommandHighlightedIndex: () => 0,
    setChatAttachmentError: () => {},
    setDraftAttachments: () => [],
    setThreadError: () => {},
    setActiveMainTab: () => {},
    sendMessage: async () => {},
    logClientError: () => {},
    ...overrides,
  };
}

describe("createChatComposerHandlers", () => {
  it("applies a selected chat command suggestion and clears the token", () => {
    const applySuggestion = vi.fn();
    const setPendingChatCommandCursorIndex = vi.fn();
    const setDraft = vi.fn();
    const setChatComposerCursorIndex = vi.fn();
    const setChatCommandHighlightedIndex = vi.fn();
    const setChatAttachmentError = vi.fn();
    const handlers = createChatComposerHandlers(
      createBaseDependencies({
        readDraft: () => "$skill",
        readActiveChatCommandMatch: () => ({
          keyword: "$",
          query: "skill",
          rangeStart: 0,
          rangeEnd: 6,
        }),
        readActiveChatCommandProvider: () => ({
          keyword: "$",
          emptyHint: "No matching Skills.",
          readSuggestions: () => [],
          applySuggestion,
        }),
        readActiveChatCommandSuggestions: () => [
          {
            id: "skill-a",
            label: "Skill A",
            description: "Skill A description",
            detail: "detail",
            isSelected: false,
            isAvailable: true,
          },
        ],
        setPendingChatCommandCursorIndex,
        setDraft,
        setChatComposerCursorIndex,
        setChatCommandHighlightedIndex,
        setChatAttachmentError,
      }),
    );

    handlers.handleSelectActiveChatCommandSuggestion("skill-a");

    expect(applySuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ id: "skill-a" }),
    );
    expect(setPendingChatCommandCursorIndex).toHaveBeenCalledWith(0);
    expect(setDraft).toHaveBeenCalledWith("");
    expect(setChatComposerCursorIndex).toHaveBeenCalledWith(0);
    expect(setChatCommandHighlightedIndex).toHaveBeenCalledWith(0);
    expect(setChatAttachmentError).toHaveBeenCalledWith(null);
  });

  it("rejects unsupported attachment extensions", async () => {
    const setChatAttachmentError = vi.fn();
    const handlers = createChatComposerHandlers(
      createBaseDependencies({
        chatAttachmentFormatHint: ".md, .txt",
        setChatAttachmentError,
      }),
    );
    const input = {
      files: [
        new File(["binary"], "payload.exe", {
          type: "application/octet-stream",
        }),
      ],
      value: "selected",
    } as unknown as HTMLInputElement;

    await handlers.handleChatAttachmentFileChange({
      currentTarget: input,
    } as ChangeEvent<HTMLInputElement>);

    expect(setChatAttachmentError).toHaveBeenCalledWith(null);
    expect(setChatAttachmentError).toHaveBeenLastCalledWith(
      'Attachment "payload.exe" is not supported. Only .md, .txt files can be attached.',
    );
    expect(input.value).toBe("");
  });

  it("opens the attachment file picker through the browser adapter", () => {
    const setChatAttachmentError = vi.fn();
    const openChatAttachmentPicker = vi.fn(() => true);
    const input = {} as HTMLInputElement;
    const handlers = createChatComposerHandlers(
      createBaseDependencies({
        readChatAttachmentInput: () => input,
        setChatAttachmentError,
        openChatAttachmentPicker,
      }),
    );

    handlers.handleOpenChatAttachmentPicker();

    expect(setChatAttachmentError).toHaveBeenCalledWith(null);
    expect(openChatAttachmentPicker).toHaveBeenCalledWith(input);
  });

  it("shows an error when the attachment file picker cannot open", () => {
    const setChatAttachmentError = vi.fn();
    const handlers = createChatComposerHandlers(
      createBaseDependencies({
        setChatAttachmentError,
        openChatAttachmentPicker: () => false,
      }),
    );

    handlers.handleOpenChatAttachmentPicker();

    expect(setChatAttachmentError).toHaveBeenNthCalledWith(1, null);
    expect(setChatAttachmentError).toHaveBeenNthCalledWith(
      2,
      "Attachment file picker is unavailable right now.",
    );
  });

  it("removes a draft attachment and clears attachment errors", () => {
    const setDraftAttachments = vi.fn();
    const setChatAttachmentError = vi.fn();
    const handlers = createChatComposerHandlers(
      createBaseDependencies({
        setDraftAttachments,
        setChatAttachmentError,
      }),
    );
    const currentAttachments: DraftChatAttachment[] = [
      {
        id: "attachment-1",
        name: "a.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
        dataUrl: "data:text/plain;base64,YQ==",
      },
      {
        id: "attachment-2",
        name: "b.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
        dataUrl: "data:text/plain;base64,Yg==",
      },
    ];

    handlers.handleRemoveDraftAttachment("attachment-1");

    const updater = setDraftAttachments.mock.calls[0]?.[0] as
      | ((current: DraftChatAttachment[]) => DraftChatAttachment[])
      | undefined;
    expect(updater?.(currentAttachments)).toEqual([currentAttachments[1]]);
    expect(setChatAttachmentError).toHaveBeenCalledWith(null);
  });
});
