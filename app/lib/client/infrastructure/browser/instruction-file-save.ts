import {
  INSTRUCTION_SAVE_FILE_TYPES,
  type InstructionSaveFileType,
} from "~/lib/constants/instruction";
import {
  readFileSaveStrategy,
} from "~/lib/client/infrastructure/browser/workspace-runtime-capabilities";

export type SaveInstructionToClientFileResult = {
  fileName: string;
  strategy: "save-picker" | "download";
};

type SaveFilePickerOptionsCompat = {
  suggestedName?: string;
  types?: InstructionSaveFileType[];
};

type SaveFileWritableStream = {
  write(data: string): Promise<void>;
  close(): Promise<void>;
};

type SaveFileHandleCompat = {
  name: string;
  createWritable(): Promise<SaveFileWritableStream>;
};

type WindowWithSaveFilePicker = Window & {
  showSaveFilePicker?: (options?: SaveFilePickerOptionsCompat) => Promise<SaveFileHandleCompat>;
};

export async function saveInstructionToClientFile(
  instruction: string,
  suggestedFileName: string,
): Promise<SaveInstructionToClientFileResult> {
  const strategy = readFileSaveStrategy();
  if (strategy === "save-picker") {
    const savePickerWindow = window as WindowWithSaveFilePicker;
    const showSaveFilePicker = savePickerWindow.showSaveFilePicker;
    if (typeof showSaveFilePicker !== "function") {
      throw new Error("Instruction file save is unavailable in this runtime.");
    }
    try {
      const fileHandle = await showSaveFilePicker({
        suggestedName: suggestedFileName,
        types: INSTRUCTION_SAVE_FILE_TYPES,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(instruction);
      await writable.close();
      return {
        fileName: fileHandle.name || suggestedFileName,
        strategy: "save-picker",
      };
    } catch (error) {
      if (isInstructionSaveCanceled(error)) {
        throw error;
      }

      if (!shouldFallbackToDownload(error)) {
        throw error;
      }
    }
  }

  if (strategy === "unavailable") {
    throw new Error("Instruction file save is unavailable in this runtime.");
  }

  downloadInstructionFile(instruction, suggestedFileName);
  return {
    fileName: suggestedFileName,
    strategy: "download",
  };
}

export function isInstructionSaveCanceled(error: unknown): boolean {
  if (!(error instanceof DOMException)) {
    return false;
  }

  return error.name === "AbortError";
}

function downloadInstructionFile(instruction: string, fileName: string): void {
  const blob = new Blob([instruction], {
    type: resolveInstructionMimeType(fileName),
  });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // Delay revoke so browser/webview download pipelines can consume the blob URL.
  window.setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 0);
}

function resolveInstructionMimeType(fileName: string): string {
  const extension = getFileExtension(fileName);
  if (extension === "json") {
    return "application/json;charset=utf-8";
  }

  if (extension === "xml") {
    return "application/xml;charset=utf-8";
  }

  if (extension === "md") {
    return "text/markdown;charset=utf-8";
  }

  return "text/plain;charset=utf-8";
}

function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function shouldFallbackToDownload(error: unknown): boolean {
  if (error instanceof DOMException) {
    return (
      error.name === "SecurityError" ||
      error.name === "NotAllowedError" ||
      error.name === "NotSupportedError"
    );
  }

  return error instanceof TypeError;
}
