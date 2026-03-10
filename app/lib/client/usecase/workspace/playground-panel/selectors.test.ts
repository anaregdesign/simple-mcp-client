import { describe, expect, it } from "vitest";
import {
  selectPlaygroundComposerViewModel,
  selectPlaygroundOperationLogViewModel,
} from "~/lib/client/usecase/workspace/playground-panel/selectors";

describe("selectPlaygroundOperationLogViewModel", () => {
  it("groups operation logs by active and error turns", () => {
    const viewModel = selectPlaygroundOperationLogViewModel({
      mcpRpcLogs: [
        {
          id: "log-1",
          sequence: 1,
          operationType: "mcp",
          serverName: "Server",
          method: "tool.call",
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:00:01.000Z",
          request: {},
          response: {},
          isError: false,
          turnId: "turn-1",
        },
        {
          id: "log-2",
          sequence: 2,
          operationType: "mcp",
          serverName: "Server",
          method: "tool.call",
          startedAt: "2026-01-01T00:00:02.000Z",
          completedAt: "2026-01-01T00:00:03.000Z",
          request: {},
          response: {},
          isError: true,
          turnId: "turn-2",
        },
      ],
      activeTurnId: "turn-1",
      lastErrorTurnId: "turn-2",
    });

    expect(viewModel.threadOperationLogsByTurnId.get("turn-1")).toHaveLength(1);
    expect(viewModel.activeTurnOperationLogs).toEqual([
      expect.objectContaining({
        id: "log-1",
      }),
    ]);
    expect(viewModel.errorTurnOperationLogs).toEqual([
      expect.objectContaining({
        id: "log-2",
      }),
    ]);
  });
});

describe("selectPlaygroundComposerViewModel", () => {
  it("builds attachment metrics and send guard flags", () => {
    const viewModel = selectPlaygroundComposerViewModel({
      draft: "Hello",
      draftAttachments: [
        {
          id: "attachment-1",
          name: "guide.pdf",
          mimeType: "application/pdf",
          sizeBytes: 10,
          dataUrl: "data:application/pdf;base64,AA==",
        },
        {
          id: "attachment-2",
          name: "notes.txt",
          mimeType: "text/plain",
          sizeBytes: 20,
          dataUrl: "data:text/plain;base64,AA==",
        },
      ],
      threadOperationPhase: "idle",
      isSending: false,
      isActiveThreadArchived: false,
      isChatLocked: false,
      isLoadingAzureConnections: false,
      isLoadingAzureDeployments: false,
      hasActiveThreadId: true,
      hasActivePlaygroundAzureConnection: true,
      hasSelectedPlaygroundAzureDeploymentName: true,
      isSelectedPlaygroundReasoningEffortOptionAvailable: true,
      isPlaygroundReasoningEffortWebSearchCompatible: true,
    });

    expect(viewModel.draftAttachmentTotalSizeBytes).toBe(30);
    expect(viewModel.draftPdfAttachmentTotalSizeBytes).toBe(10);
    expect(viewModel.messageAttachmentAccept).toContain(".pdf");
    expect(viewModel.messageAttachmentFormatHint).toContain("Code Interpreter");
    expect(viewModel.canSendMessage).toBe(true);
  });

  it("blocks send when required state is missing", () => {
    const viewModel = selectPlaygroundComposerViewModel({
      draft: " ",
      draftAttachments: [],
      threadOperationPhase: "idle",
      isSending: false,
      isActiveThreadArchived: false,
      isChatLocked: false,
      isLoadingAzureConnections: false,
      isLoadingAzureDeployments: false,
      hasActiveThreadId: false,
      hasActivePlaygroundAzureConnection: false,
      hasSelectedPlaygroundAzureDeploymentName: false,
      isSelectedPlaygroundReasoningEffortOptionAvailable: true,
      isPlaygroundReasoningEffortWebSearchCompatible: true,
    });

    expect(viewModel.canSendMessage).toBe(false);
  });
});
