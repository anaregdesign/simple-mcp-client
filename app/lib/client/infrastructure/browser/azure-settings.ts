import type { ThemeMode } from "~/lib/domain/value-objects/theme-mode";

const AZURE_CONNECTION_REFRESH_INTERVAL_MS = 4000;

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
