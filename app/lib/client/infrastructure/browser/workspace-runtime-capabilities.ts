export type ClipboardWriteStrategy =
  | "async-clipboard"
  | "exec-command"
  | "unavailable";

export type FileOpenStrategy =
  | "show-picker"
  | "input-click"
  | "unavailable";

export type FileSaveStrategy =
  | "save-picker"
  | "download"
  | "unavailable";

export type DesktopUpdaterApi = {
  getUpdaterStatus: () => Promise<unknown>;
  checkForUpdates: () => Promise<unknown>;
  onUpdaterStatus: (listener: (status: unknown) => void) => () => void;
  quitAndInstallUpdate: () => Promise<void>;
};

export type WorkspaceRuntimeCapabilities = {
  desktopUpdaterAvailable: boolean;
  clipboardWriteStrategy: ClipboardWriteStrategy;
  fileOpenStrategy: FileOpenStrategy;
  fileSaveStrategy: FileSaveStrategy;
};

type FileInputWithPicker = HTMLInputElement & {
  showPicker?: () => void;
};

type WindowWithSaveFilePicker = Window & {
  showSaveFilePicker?: (...args: unknown[]) => Promise<unknown>;
};

type WindowWithDesktopApi = Window & {
  desktopApi?: unknown;
};

export function readWorkspaceRuntimeCapabilities(): WorkspaceRuntimeCapabilities {
  return {
    desktopUpdaterAvailable: readDesktopUpdaterApi() !== null,
    clipboardWriteStrategy: readClipboardWriteStrategy(),
    fileOpenStrategy: readFileOpenStrategy(),
    fileSaveStrategy: readFileSaveStrategy(),
  };
}

export function readDesktopUpdaterApi(): DesktopUpdaterApi | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = (window as WindowWithDesktopApi).desktopApi;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const typedCandidate = candidate as Partial<DesktopUpdaterApi>;
  if (
    typeof typedCandidate.getUpdaterStatus !== "function" ||
    typeof typedCandidate.checkForUpdates !== "function" ||
    typeof typedCandidate.onUpdaterStatus !== "function" ||
    typeof typedCandidate.quitAndInstallUpdate !== "function"
  ) {
    return null;
  }

  return typedCandidate as DesktopUpdaterApi;
}

export function readClipboardWriteStrategy(): ClipboardWriteStrategy {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function"
  ) {
    return "async-clipboard";
  }

  if (typeof document !== "undefined") {
    return "exec-command";
  }

  return "unavailable";
}

export function readFileOpenStrategy(
  input?: HTMLInputElement | null,
): FileOpenStrategy {
  const inputWithPicker = input as FileInputWithPicker | null | undefined;
  if (typeof inputWithPicker?.showPicker === "function") {
    return "show-picker";
  }

  if (
    !input &&
    typeof HTMLInputElement !== "undefined" &&
    typeof (HTMLInputElement.prototype as FileInputWithPicker).showPicker ===
      "function"
  ) {
    return "show-picker";
  }

  if (typeof document !== "undefined") {
    return "input-click";
  }

  return "unavailable";
}

export function readFileSaveStrategy(): FileSaveStrategy {
  if (typeof window !== "undefined") {
    const savePickerWindow = window as WindowWithSaveFilePicker;
    if (typeof savePickerWindow.showSaveFilePicker === "function") {
      return "save-picker";
    }
  }

  if (
    typeof document !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  ) {
    return "download";
  }

  return "unavailable";
}
