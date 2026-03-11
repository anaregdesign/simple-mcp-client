import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readClipboardWriteStrategy,
  readDesktopUpdaterApi,
  readFileOpenStrategy,
  readFileSaveStrategy,
  readWorkspaceRuntimeCapabilities,
} from "./workspace-runtime-capabilities";

describe("workspace runtime capabilities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("detects desktop updater capability only when the bridge exposes all updater methods", () => {
    vi.stubGlobal("window", {
      desktopApi: {
        getUpdaterStatus: async () => ({}),
        checkForUpdates: async () => ({}),
        onUpdaterStatus: () => () => undefined,
        quitAndInstallUpdate: async () => undefined,
      },
    });

    expect(readWorkspaceRuntimeCapabilities().desktopUpdaterAvailable).toBe(
      true,
    );
    expect(readDesktopUpdaterApi()).not.toBeNull();
  });

  it("reads clipboard and file strategies from the current runtime", () => {
    vi.stubGlobal("window", {
      showSaveFilePicker: async () => ({}),
    });
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: async () => undefined,
      },
    });
    vi.stubGlobal("document", {
      createElement: () => ({}),
    });

    const input = {
      showPicker: () => undefined,
    } as HTMLInputElement;

    expect(readClipboardWriteStrategy()).toBe("async-clipboard");
    expect(readFileOpenStrategy(input)).toBe("show-picker");
    expect(readFileSaveStrategy()).toBe("save-picker");
  });

  it("falls back to unavailable strategies outside browser-like globals", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("URL", undefined);

    expect(readWorkspaceRuntimeCapabilities()).toEqual({
      desktopUpdaterAvailable: false,
      clipboardWriteStrategy: "unavailable",
      fileOpenStrategy: "unavailable",
      fileSaveStrategy: "unavailable",
    });
  });
});
