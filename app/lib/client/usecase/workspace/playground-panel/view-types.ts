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

export type ThreadMcpConnectionView =
  | ThreadMcpConnectionHttpView
  | ThreadMcpConnectionStdioView;
