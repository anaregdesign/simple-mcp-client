import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyBrowserTheme,
  clearAzureSettingsTimeout,
  installAzureConnectionRefreshLoop,
  isBrowserDocumentVisible,
  scheduleWorkspaceMcpServerProfileLoginRetry,
  waitForAzureCatalogRetryDelay,
} from "~/lib/client/infrastructure/browser/azure-settings";

describe("isBrowserDocumentVisible", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns true when the document is visible", () => {
    vi.stubGlobal("document", {
      visibilityState: "visible",
    });

    expect(isBrowserDocumentVisible()).toBe(true);
  });

  it("returns false when the document is hidden", () => {
    vi.stubGlobal("document", {
      visibilityState: "hidden",
    });

    expect(isBrowserDocumentVisible()).toBe(false);
  });
});

describe("applyBrowserTheme", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes the selected theme to the root document element", () => {
    const documentStub = {
      documentElement: {
        dataset: {} as Record<string, string>,
      },
    };
    vi.stubGlobal("document", documentStub);

    applyBrowserTheme("dark");

    expect(documentStub.documentElement.dataset.theme).toBe("dark");
  });
});

describe("installAzureConnectionRefreshLoop", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("refreshes on interval, focus, and visibility change until disposed", () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn();
    const windowTarget = new EventTarget();
    const documentTarget = new EventTarget();
    const documentStub = {
      visibilityState: "visible",
      documentElement: {
        dataset: {} as Record<string, string>,
      },
      addEventListener: documentTarget.addEventListener.bind(documentTarget),
      removeEventListener:
        documentTarget.removeEventListener.bind(documentTarget),
      dispatchEvent: documentTarget.dispatchEvent.bind(documentTarget),
    };
    const windowStub = {
      setInterval: globalThis.setInterval.bind(globalThis),
      clearInterval: globalThis.clearInterval.bind(globalThis),
      addEventListener: windowTarget.addEventListener.bind(windowTarget),
      removeEventListener: windowTarget.removeEventListener.bind(windowTarget),
      dispatchEvent: windowTarget.dispatchEvent.bind(windowTarget),
    };
    vi.stubGlobal("document", documentStub);
    vi.stubGlobal("window", windowStub);

    const dispose = installAzureConnectionRefreshLoop(onRefresh);

    vi.advanceTimersByTime(4000);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    windowStub.dispatchEvent(new Event("focus"));
    expect(onRefresh).toHaveBeenCalledTimes(2);

    documentStub.dispatchEvent(new Event("visibilitychange"));
    expect(onRefresh).toHaveBeenCalledTimes(3);

    dispose();

    vi.advanceTimersByTime(4000);
    windowStub.dispatchEvent(new Event("focus"));
    documentStub.dispatchEvent(new Event("visibilitychange"));
    expect(onRefresh).toHaveBeenCalledTimes(3);
  });
});

describe("azure settings timeout helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("clears a scheduled workspace MCP Server login retry", () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const windowStub = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };
    const timeoutRef: { current: number | null } = {
      current: null,
    };
    vi.stubGlobal("window", windowStub);

    scheduleWorkspaceMcpServerProfileLoginRetry(timeoutRef, onRetry);
    clearAzureSettingsTimeout(timeoutRef);
    vi.advanceTimersByTime(1200);

    expect(onRetry).not.toHaveBeenCalled();
    expect(timeoutRef.current).toBeNull();
  });

  it("waits for the azure catalog retry delay", async () => {
    vi.useFakeTimers();
    const windowStub = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };
    vi.stubGlobal("window", windowStub);

    const waitPromise = waitForAzureCatalogRetryDelay();

    await vi.advanceTimersByTimeAsync(500);
    await expect(waitPromise).resolves.toBeUndefined();
  });
});
