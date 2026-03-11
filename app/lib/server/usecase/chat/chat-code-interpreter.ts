import type {
  ChatExecutionOptions,
  ChatExecutionPorts,
  ChatProgressEvent,
  ClientAttachment,
} from "~/lib/server/usecase/chat/chat-execution-ports";
import {
  readErrorMessage,
  truncateProgressMessage,
} from "~/lib/server/usecase/chat/chat-execution-errors";

function readFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function buildAttachmentKey(attachment: ClientAttachment): string {
  return `${attachment.name}\u0000${attachment.sizeBytes}\u0000${attachment.dataUrl}`;
}

export function hasNonPdfAttachments(attachments: ClientAttachment[]): boolean {
  return attachments.some(
    (attachment) => readFileExtension(attachment.name) !== "pdf",
  );
}

function shouldEnableCodeInterpreter(options: ChatExecutionOptions): boolean {
  if (hasNonPdfAttachments(options.attachments)) {
    return true;
  }

  return options.history.some(
    (entry) => entry.role === "user" && hasNonPdfAttachments(entry.attachments),
  );
}

function collectNonPdfAttachments(
  options: ChatExecutionOptions,
): ClientAttachment[] {
  const dedupedByKey = new Map<string, ClientAttachment>();

  const register = (attachment: ClientAttachment) => {
    if (readFileExtension(attachment.name) === "pdf") {
      return;
    }
    dedupedByKey.set(buildAttachmentKey(attachment), attachment);
  };

  for (const attachment of options.attachments) {
    register(attachment);
  }
  for (const historyEntry of options.history) {
    if (historyEntry.role !== "user") {
      continue;
    }
    for (const attachment of historyEntry.attachments) {
      register(attachment);
    }
  }

  return [...dedupedByKey.values()];
}

export async function prepareCodeInterpreterRun(options: {
  execution: ChatExecutionOptions;
  dependencies: Pick<
    ChatExecutionPorts,
    "createCodeInterpreterContainerWithAttachments"
  >;
  emitProgress: (event: ChatProgressEvent) => void;
}): Promise<{
  codeInterpreterRequested: boolean;
  enableCodeInterpreterTool: boolean;
  codeInterpreterContainerId: string;
}> {
  const { execution, dependencies, emitProgress } = options;
  const codeInterpreterRequested = shouldEnableCodeInterpreter(execution);
  let codeInterpreterEnabledForRun = false;
  let codeInterpreterContainerId = "";
  if (codeInterpreterRequested) {
    emitProgress({
      message: "Enabling Code Interpreter for non-PDF attachments...",
    });
    const nonPdfAttachments = collectNonPdfAttachments(execution);
    if (nonPdfAttachments.length > 0) {
      emitProgress({
        message: `Uploading attachments for Code Interpreter (${nonPdfAttachments.length})...`,
      });
      try {
        codeInterpreterContainerId =
          await dependencies.createCodeInterpreterContainerWithAttachments({
            attachments: nonPdfAttachments,
            azureConfig: execution.azureConfig,
          });
        codeInterpreterEnabledForRun = true;
      } catch (error) {
        const reason = readErrorMessage(error);
        emitProgress({
          message: `Code Interpreter file upload failed (${truncateProgressMessage(reason)}). Continuing without non-PDF file access.`,
        });
      }
    } else {
      codeInterpreterEnabledForRun = true;
    }
  }

  return {
    codeInterpreterRequested,
    enableCodeInterpreterTool:
      codeInterpreterEnabledForRun && codeInterpreterContainerId.length > 0,
    codeInterpreterContainerId,
  };
}
