import type { MutableRefObject } from "react";
import type { ThemeMode } from "~/lib/domain/value-objects/theme-mode";

const AZURE_CONNECTION_REFRESH_INTERVAL_MS = 4000;
const AZURE_PROJECTS_RETRY_DELAY_MS = 500;
const WORKSPACE_MCP_SERVER_PROFILE_LOGIN_RETRY_DELAY_MS = 1200;

type AzureSettingsTimeoutRef = MutableRefObject<number | null>;

export function isBrowserDocumentVisible(): boolean {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible";
}

export function applyBrowserTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
}

export function installAzureConnectionRefreshLoop(
  onRefresh: () => void | Promise<void>,
): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const handleRefresh = () => {
    void onRefresh();
  };

  const intervalId = window.setInterval(
    handleRefresh,
    AZURE_CONNECTION_REFRESH_INTERVAL_MS,
  );
  window.addEventListener("focus", handleRefresh);
  document.addEventListener("visibilitychange", handleRefresh);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener("focus", handleRefresh);
    document.removeEventListener("visibilitychange", handleRefresh);
  };
}

export function clearAzureSettingsTimeout(
  timeoutRef: AzureSettingsTimeoutRef,
): void {
  const timeoutId = timeoutRef.current;
  if (timeoutId === null) {
    return;
  }

  timeoutRef.current = null;
  if (typeof window === "undefined") {
    return;
  }

  window.clearTimeout(timeoutId);
}

export function scheduleWorkspaceMcpServerProfileLoginRetry(
  timeoutRef: AzureSettingsTimeoutRef,
  onRetry: () => void,
): void {
  clearAzureSettingsTimeout(timeoutRef);

  if (typeof window === "undefined") {
    onRetry();
    return;
  }

  timeoutRef.current = window.setTimeout(() => {
    timeoutRef.current = null;
    onRetry();
  }, WORKSPACE_MCP_SERVER_PROFILE_LOGIN_RETRY_DELAY_MS);
}

export async function waitForAzureCatalogRetryDelay(): Promise<void> {
  if (typeof window === "undefined") {
    await Promise.resolve();
    return;
  }

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, AZURE_PROJECTS_RETRY_DELAY_MS);
  });
}
