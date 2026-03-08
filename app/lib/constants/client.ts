/**
 * Impact scope:
 * These constants define client layout behavior, theme preference behavior, and runtime UX defaults.
 * Changing them affects splitter bounds, theme switching, and interactive state defaults.
 */
export const HOME_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX = 320;
export const HOME_MAIN_SPLITTER_MIN_LEFT_WIDTH_PX = 560;
export const HOME_CHAT_INPUT_MIN_HEIGHT_PX = 44;
export const HOME_CHAT_INPUT_MAX_HEIGHT_PX = 220;
export const HOME_THREAD_NAME_MAX_LENGTH = 80;

export const HOME_DEFAULT_THEME = "light" as const;
export const HOME_THEME_OPTIONS = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const;

export const HOME_MAIN_VIEW_TAB_OPTIONS = [
  { id: "threads", label: "🧵 Threads" },
  { id: "mcp", label: "🧩 MCP Servers" },
  { id: "skills", label: "🧠 Skills" },
  { id: "settings", label: "⚙️ Settings" },
] as const;

export const HOME_INITIAL_MESSAGES: ReadonlyArray<never> = [];
export const HOME_NO_AVAILABLE_PROJECTS_OPTION_LABEL = "No Available Projects in Selected Tenant";
export const HOME_NO_AVAILABLE_DEPLOYMENTS_OPTION_LABEL =
  "No Available Deployments in Selected Tenant";
export const HOME_DEFAULT_THREAD_REQUEST_STATE = {
  isSending: false,
  sendProgressMessages: [] as string[],
  activeTurnId: null as string | null,
  lastErrorTurnId: null as string | null,
  error: null as string | null,
};

export const AUTO_DISMISS_STATUS_DEFAULT_MS = 5_000;
export const CLIENT_EVENT_LOG_DEDUPE_WINDOW_MS = 1_500;
