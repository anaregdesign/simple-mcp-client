export const MCP_CMD_DEFAULT_TIMEOUT_SECONDS = 120;
export const MCP_CMD_MAX_TIMEOUT_SECONDS = 600;
export const MCP_CMD_MAX_COMMAND_LENGTH = 32_000;

const MCP_CMD_CRITICAL_COMMAND_PATTERNS = [
  /\brm\s+-rf\s+\/($|\s)/i,
  /\bmkfs(\.[a-z0-9]+)?\b/i,
  /\bfdisk\b/i,
  /\bdiskutil\s+erase/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\bhalt\b/i,
  /\bformat\s+[a-z]:/i,
];

const MCP_CMD_SENSITIVE_PATH_PATTERNS = [
  /(^|[\\/])\.ssh([\\/]|$)/i,
  /(^|[\\/])\.aws([\\/]|$)/i,
  /(^|[\\/])\.azure([\\/]|$)/i,
  /(^|[\\/])\.gnupg([\\/]|$)/i,
  /(^|[\\/])\.kube([\\/]|$)/i,
  /(^|[\\/])\.git-credentials([\\/]|$)/i,
  /(^|[\\/])\.config[\\/]gcloud([\\/]|$)/i,
  /(^|[\\/])Library[\\/]Keychains([\\/]|$)/i,
  /(^|[\\/])AppData[\\/]Roaming[\\/]Microsoft[\\/]Credentials([\\/]|$)/i,
  /(^|[\\/])etc[\\/](passwd|shadow|sudoers)\b/i,
  /(^|[\\/])var[\\/]run([\\/]|$)/i,
  /(^|[\\/])proc([\\/]|$)/i,
  /(^|[\\/])sys([\\/]|$)/i,
];

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type CommandDirectoryScope = {
  threadDirectory: string;
  workingDirectory: string;
};

export type McpCmdToolContext = {
  userId: number;
  threadId: string | null;
  turnId: string | null;
};

export type McpCmdToolThreadContext = {
  threadId: string | null;
  turnId: string | null;
};

export type ShellFamily = "posix" | "powershell" | "cmd";

export type McpCmdShell = {
  executable: string;
  argsPrefix: string[];
  family: ShellFamily;
  source: string;
  platform: string;
};

export type ParsedCmdToolArguments = {
  threadId: string | null;
  command: string;
  workingDirectory: string | null;
  timeoutSeconds: number;
};

export type CommandExecutionResult = {
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  durationMs: number;
  shell: McpCmdShell;
};

export type McpCmdSuccessPayload = {
  executed: true;
  command: string;
  workingDirectory: string;
  timeoutSeconds: number;
  threadContext: McpCmdToolThreadContext;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  durationMs: number;
  shell: McpCmdShell;
};

export type McpCmdErrorPayload = {
  executed: false;
  error: string;
  threadContext: McpCmdToolThreadContext;
  command?: string;
  workingDirectory?: string;
  timeoutSeconds?: number;
  shell?: McpCmdShell;
};

export type McpCmdToolPayload = McpCmdSuccessPayload | McpCmdErrorPayload;

export type McpCmdToolCallResult = {
  isError: boolean;
  payload: McpCmdToolPayload;
};

type McpCmdErrorPayloadInput = Omit<McpCmdErrorPayload, "executed">;

export interface McpCmdShellGateway {
  executeCommand(options: {
    command: string;
    threadDirectory: string;
    workingDirectory: string;
    timeoutSeconds: number;
  }): Promise<{ ok: true; value: CommandExecutionResult } | { ok: false; error: string; shell?: McpCmdShell }>;
}

export interface McpCmdServiceDependencies {
  resolveWorkingDirectory: (
    userId: number,
    threadId: string | null,
    workingDirectory: string | null,
  ) => ParseResult<CommandDirectoryScope>;
  shellGateway: McpCmdShellGateway;
}

export class McpCmdService {
  constructor(private readonly dependencies: McpCmdServiceDependencies) {}

  async executeTool(
    requestContext: McpCmdToolContext,
    rawArguments: unknown,
  ): Promise<McpCmdToolCallResult> {
    const parsedArguments = parseCmdExecuteArguments(rawArguments);
    if (!parsedArguments.ok) {
      return buildErrorResult({
        error: parsedArguments.error,
        threadContext: readThreadContext(requestContext),
      });
    }

    const commandArgs = parsedArguments.value;
    const effectiveThreadId = commandArgs.threadId ?? requestContext.threadId;
    const effectiveThreadContext = {
      threadId: effectiveThreadId,
      turnId: requestContext.turnId,
    };

    const directoryScopeResult = this.dependencies.resolveWorkingDirectory(
      requestContext.userId,
      effectiveThreadId,
      commandArgs.workingDirectory,
    );
    if (!directoryScopeResult.ok) {
      return buildErrorResult({
        error: directoryScopeResult.error,
        threadContext: effectiveThreadContext,
      });
    }
    const directoryScope = directoryScopeResult.value;

    const commandSecurityResult = evaluateCommandSecurityPolicy(commandArgs.command);
    if (!commandSecurityResult.ok) {
      return buildErrorResult({
        error: commandSecurityResult.error,
        command: commandArgs.command,
        workingDirectory: directoryScope.workingDirectory,
        threadContext: effectiveThreadContext,
      });
    }

    const commandResult = await this.dependencies.shellGateway.executeCommand({
      command: commandArgs.command,
      threadDirectory: directoryScope.threadDirectory,
      workingDirectory: directoryScope.workingDirectory,
      timeoutSeconds: commandArgs.timeoutSeconds,
    });

    if (!commandResult.ok) {
      return buildErrorResult({
        error: commandResult.error,
        command: commandArgs.command,
        workingDirectory: directoryScope.workingDirectory,
        timeoutSeconds: commandArgs.timeoutSeconds,
        threadContext: effectiveThreadContext,
        ...(commandResult.shell ? { shell: commandResult.shell } : {}),
      });
    }

    return {
      isError: false,
      payload: {
        executed: true,
        command: commandArgs.command,
        workingDirectory: directoryScope.workingDirectory,
        timeoutSeconds: commandArgs.timeoutSeconds,
        threadContext: effectiveThreadContext,
        stdout: commandResult.value.stdout,
        stderr: commandResult.value.stderr,
        stdoutTruncated: commandResult.value.stdoutTruncated,
        stderrTruncated: commandResult.value.stderrTruncated,
        exitCode: commandResult.value.exitCode,
        signal: commandResult.value.signal,
        timedOut: commandResult.value.timedOut,
        durationMs: commandResult.value.durationMs,
        shell: commandResult.value.shell,
      },
    };
  }
}

function buildErrorResult(payload: McpCmdErrorPayloadInput): McpCmdToolCallResult {
  return {
    isError: true,
    payload: {
      executed: false,
      ...payload,
    },
  };
}

function readThreadContext(
  requestContext: McpCmdToolContext,
): McpCmdToolThreadContext {
  return {
    threadId: requestContext.threadId,
    turnId: requestContext.turnId,
  };
}

function parseCmdExecuteArguments(
  value: unknown,
): ParseResult<ParsedCmdToolArguments> {
  if (!isRecord(value)) {
    return { ok: false, error: "Tool arguments must be a JSON object." };
  }

  const rawCommand = value.command;
  if (typeof rawCommand !== "string") {
    return { ok: false, error: "`command` must be a string." };
  }
  const command = rawCommand.trim();
  if (!command) {
    return { ok: false, error: "`command` must not be empty." };
  }
  if (command.length > MCP_CMD_MAX_COMMAND_LENGTH) {
    return {
      ok: false,
      error: `\`command\` must be ${MCP_CMD_MAX_COMMAND_LENGTH} characters or fewer.`,
    };
  }

  const rawWorkingDirectory = value.workingDirectory;
  let workingDirectory: string | null = null;
  if (rawWorkingDirectory !== undefined && rawWorkingDirectory !== null) {
    if (typeof rawWorkingDirectory !== "string") {
      return {
        ok: false,
        error: "`workingDirectory` must be a string when provided.",
      };
    }

    const normalizedWorkingDirectory = rawWorkingDirectory.trim();
    if (normalizedWorkingDirectory.length > 0) {
      workingDirectory = normalizedWorkingDirectory;
    }
  }

  const timeoutSecondsResult = parseTimeoutSeconds(value.timeoutSeconds);
  if (!timeoutSecondsResult.ok) {
    return timeoutSecondsResult;
  }

  const threadIdResult = parseThreadId(value.threadId);
  if (!threadIdResult.ok) {
    return threadIdResult;
  }

  return {
    ok: true,
    value: {
      threadId: threadIdResult.value,
      command,
      workingDirectory,
      timeoutSeconds: timeoutSecondsResult.value,
    },
  };
}

function parseThreadId(rawThreadId: unknown): ParseResult<string | null> {
  if (rawThreadId === undefined || rawThreadId === null) {
    return { ok: true, value: null };
  }

  if (typeof rawThreadId !== "string") {
    return { ok: false, error: "`threadId` must be a string when provided." };
  }

  const threadId = rawThreadId.trim();
  if (!threadId) {
    return { ok: false, error: "`threadId` must not be empty when provided." };
  }

  return { ok: true, value: threadId };
}

function parseTimeoutSeconds(rawTimeoutSeconds: unknown): ParseResult<number> {
  if (rawTimeoutSeconds === undefined || rawTimeoutSeconds === null) {
    return { ok: true, value: MCP_CMD_DEFAULT_TIMEOUT_SECONDS };
  }

  if (
    typeof rawTimeoutSeconds !== "number" ||
    !Number.isSafeInteger(rawTimeoutSeconds)
  ) {
    return { ok: false, error: "`timeoutSeconds` must be an integer." };
  }

  if (
    rawTimeoutSeconds < 1 ||
    rawTimeoutSeconds > MCP_CMD_MAX_TIMEOUT_SECONDS
  ) {
    return {
      ok: false,
      error: `\`timeoutSeconds\` must be between 1 and ${MCP_CMD_MAX_TIMEOUT_SECONDS}.`,
    };
  }

  return { ok: true, value: rawTimeoutSeconds };
}

function evaluateCommandSecurityPolicy(command: string): ParseResult<true> {
  const tokensResult = tokenizeShellCommand(command);
  if (!tokensResult.ok) {
    return tokensResult;
  }
  const tokens = tokensResult.value;
  if (tokens.length === 0) {
    return {
      ok: false,
      error: "Command must include an executable name.",
    };
  }

  if (!readExecutableName(tokens[0])) {
    return {
      ok: false,
      error: "Command executable is invalid.",
    };
  }

  const criticalPatternMatch = readMatchedPattern(
    command,
    MCP_CMD_CRITICAL_COMMAND_PATTERNS,
  );
  if (criticalPatternMatch) {
    return {
      ok: false,
      error: `Command matches blocked critical operation pattern '${criticalPatternMatch}' in /mcp/cmd security policy.`,
    };
  }

  const sensitivePathPatternMatch = readMatchedPattern(
    command,
    MCP_CMD_SENSITIVE_PATH_PATTERNS,
  );
  if (sensitivePathPatternMatch) {
    return {
      ok: false,
      error: `Command references a sensitive path pattern '${sensitivePathPatternMatch}' blocked by /mcp/cmd security policy.`,
    };
  }

  return { ok: true, value: true };
}

function tokenizeShellCommand(command: string): ParseResult<string[]> {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;

  for (const character of command) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }
    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (escaping) {
    return {
      ok: false,
      error: "Command has an invalid trailing escape character.",
    };
  }
  if (quote) {
    return {
      ok: false,
      error: "Command has an unmatched quote.",
    };
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  return {
    ok: true,
    value: tokens,
  };
}

function readExecutableName(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\\/g, "/");
  const segments = normalized.split("/");
  const executable = segments[segments.length - 1]?.trim().toLowerCase() ?? "";
  return executable.length > 0 ? executable : null;
}

function readMatchedPattern(
  command: string,
  patterns: RegExp[],
): string | null {
  for (const pattern of patterns) {
    if (pattern.test(command)) {
      return pattern.source;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
