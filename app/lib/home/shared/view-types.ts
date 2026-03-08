/**
 * Client runtime support module.
 */
import type { ThreadInstructionContextToggleKey } from "~/lib/home/thread/instruction-context";

export type MainViewTab = "settings" | "skills" | "mcp" | "threads";
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type McpTransport = "streamable_http" | "sse" | "stdio";
export type HomeTheme = "light" | "dark";

export type ThreadMessageRole = "user" | "assistant";

export type ThreadSkillView = {
  name: string;
  location: string;
};

export type ThreadMessageView = {
  id: string;
  role: ThreadMessageRole;
  content: string;
  turnId: string;
  skillActivations?: ThreadSkillView[];
};

export type ThreadMessageAttachmentView = {
  id: string;
  name: string;
  sizeBytes: number;
};

export type ChatCommandSuggestionView = {
  id: string;
  label: string;
  description: string;
  detail: string;
  isSelected: boolean;
  isAvailable: boolean;
};

export type ChatCommandMenuView = {
  keyword: string;
  query: string;
  emptyHint: string;
  highlightedIndex: number;
  suggestions: ChatCommandSuggestionView[];
};

export type DesktopUpdaterStatusView = {
  supported: boolean;
  checking: boolean;
  updateAvailable: boolean;
  updateDownloaded: boolean;
  currentVersion: string;
  availableVersion: string;
  errorMessage: string;
  lastCheckedAt: string;
};

export type AzureConnectionOptionView = {
  id: string;
  projectName: string;
};

export type ThreadOperationLogEntryView = {
  id: string;
};

export type ThreadMcpConnectionHttpView = {
  id: string;
  name: string;
  transport: "streamable_http" | "sse";
  url: string;
  headers: Record<string, string>;
  useAzureAuth: boolean;
  azureAuthScope: string;
  timeoutSeconds: number;
};

export type ThreadMcpConnectionStdioView = {
  id: string;
  name: string;
  transport: "stdio";
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
};

export type ThreadMcpConnectionView = ThreadMcpConnectionHttpView | ThreadMcpConnectionStdioView;

export type InstructionLanguage = "japanese" | "english" | "mixed" | "unknown";

export type InstructionEnhanceComparisonView = {
  extension: string;
  language: InstructionLanguage;
  diffPatch: string;
};

export type InstructionContextToggleOptionView = {
  key: ThreadInstructionContextToggleKey;
  label: string;
  infoTitle: string;
  infoLines: string[];
  enabled: boolean;
};

export type AzureConnectionView = {
  projectName: string;
  baseUrl: string;
  apiVersion: string;
};

export type AzurePrincipalType = "user" | "servicePrincipal" | "managedIdentity" | "unknown";

export type AzurePrincipalView = {
  tenantId: string;
  principalId: string;
  displayName: string;
  principalName: string;
  principalType: AzurePrincipalType;
};

export type AzureTenantView = {
  tenantId: string;
  displayName: string;
  defaultDomain: string;
};

export type McpServersAuthState = {
  authRequired?: boolean;
};
