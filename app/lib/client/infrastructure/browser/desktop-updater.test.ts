import { describe, expect, it, vi } from "vitest";
import {
  readDesktopUpdaterStatusFromUnknown,
} from "~/lib/client/infrastructure/browser/desktop-updater";
import {
  readDesktopUpdaterApi,
} from "~/lib/client/infrastructure/browser/workspace-runtime-capabilities";

describe("readDesktopUpdaterStatusFromUnknown", () => {
  it("parses a valid desktop updater payload", () => {
    expect(
      readDesktopUpdaterStatusFromUnknown({
        supported: true,
        checking: false,
        updateAvailable: true,
        updateDownloaded: false,
        currentVersion: " 1.0.0 ",
        availableVersion: " 1.1.0 ",
        errorMessage: " ",
        lastCheckedAt: " 2026-03-10T00:00:00.000Z ",
      }),
    ).toEqual({
      supported: true,
      checking: false,
      updateAvailable: true,
      updateDownloaded: false,
      currentVersion: "1.0.0",
      availableVersion: "1.1.0",
      errorMessage: "",
      lastCheckedAt: "2026-03-10T00:00:00.000Z",
    });
  });

  it("returns null when required boolean fields are missing", () => {
    expect(
      readDesktopUpdaterStatusFromUnknown({
        supported: true,
      }),
    ).toBeNull();
  });
});

describe("readDesktopUpdaterApi", () => {
  it("returns null when desktopApi is unavailable", () => {
    expect(readDesktopUpdaterApi()).toBeNull();
  });

  it("returns null when desktopApi is missing required functions", () => {
    vi.stubGlobal("window", {
      desktopApi: {
        getUpdaterStatus: async () => ({}),
      },
    });

    expect(readDesktopUpdaterApi()).toBeNull();
    vi.unstubAllGlobals();
  });
});
