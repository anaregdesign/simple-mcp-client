/**
 * MCP route module for /mcp/cmd shell command server.
 */
import childProcess from "node:child_process";
import fs from "node:fs";
import nodeOs from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import * as z from "zod/v4";
import {
  MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER,
  MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER,
} from "~/lib/constants/mcp";
import { resolveWorkspaceThreadDirectory } from "~/lib/server/infrastructure/config/workspace-storage-paths";
import { readAzureArmUserContext } from "~/lib/server/auth/azure-user";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/observability/runtime-event-log";
import { getOrCreateUserByIdentity } from "~/lib/server/infrastructure/persistence/user";

const MCP_CMD_ROUTE_PATH = "/mcp/cmd";
const MCP_CMD_AUTH_REQUIRED_MESSAGE =
  "Authentication required. Click Azure Login in Settings and try again.";
const MCP_CMD_TOOL_NAME = "shell_execute_command";
const MCP_CMD_TOOL_DESCRIPTION = [
  "Executes an arbitrary shell command on the Local Playground host.",
  "Returns stdout/stderr, exit status, timeout state, execution duration, and resolved shell metadata.",
  "Security policy: critical destructive command patterns are blocked.",
  "Security policy: sensitive credential/system path references are blocked.",
  "Security policy: command environment is sanitized and scoped to the thread directory.",
  "Default working directory is the workspace thread directory under the Local Playground storage root.",
  "threadContext.threadId is required for secure command execution.",
].join("\n");

const MCP_CMD_DEFAULT_TIMEOUT_SECONDS = 120;
const MCP_CMD_MAX_TIMEOUT_SECONDS = 600;
const MCP_CMD_OUTPUT_MAX_BYTES = 1_000_000;
const MCP_CMD_MAX_COMMAND_LENGTH = 32_000;
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

const MCP_CMD_ALLOWED_ENVIRONMENT_KEYS = new Set([
  "COMSPEC",
  "LANG",
  "LC_ALL",
  "PATH",
  "PATHEXT",
  "SHELL",
  "SYSTEMROOT",
  "TERM",
  "WINDIR",
]);

const cmdExecuteInputSchema = {
  threadId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional thread identifier supplied by the client. When provided, this value is used for default working directory resolution.",
    ),
  command: z
    .string()
    .min(1)
    .max(MCP_CMD_MAX_COMMAND_LENGTH)
    .describe(
      "Shell command to execute in the selected shell environment (for example: `ls -la`, `npm run test`, `git status`).",
    ),
  workingDirectory: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional working directory. Relative paths are resolved from the Local Playground process current directory. When omitted, uses the workspace thread directory under the Local Playground storage root.",
    ),
  timeoutSeconds: z
    .number()
    .int()
    .min(1)
    .max(MCP_CMD_MAX_TIMEOUT_SECONDS)
    .optional()
    .describe(
      `Execution timeout in seconds. Defaults to ${MCP_CMD_DEFAULT_TIMEOUT_SECONDS} (max ${MCP_CMD_MAX_TIMEOUT_SECONDS}).`,
    ),
};

type AuthenticatedMcpCmdContext = {
  userId: number;
  tenantId: string;
  principalId: string;
};

type McpCmdRequestContext = AuthenticatedMcpCmdContext & {
  threadId: string | null;
  turnId: string | null;
};

type ParsedCmdToolArguments = {
  threadId: string | null;
  command: string;
  workingDirectory: string | null;
  timeoutSeconds: number;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

type CommandDirectoryScope = {
  threadDirectory: string;
  workingDirectory: string;
};

type ShellFamily = "posix" | "powershell" | "cmd";

type ShellExecutionContext = {
  executable: string;
  argsPrefix: string[];
  probeArgs: string[];
  family: ShellFamily;
  source: string;
};

type OutputCollector = {
  chunks: Buffer[];
  size: number;
  truncated: boolean;
};

type CommandExecutionResult = {
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  durationMs: number;
};

export async function loader({ request }: { request: Request }) {
  installGlobalServerErrorLogging();
  return handleMcpRequest(request);
}

export async function action({ request }: { request: Request }) {
  installGlobalServerErrorLogging();
  return handleMcpRequest(request);
}

async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: `Method not allowed. Use POST ${MCP_CMD_ROUTE_PATH}.`,
        },
        id: null,
      },
      { status: 405 },
    );
  }

  const authenticatedContext = await readAuthenticatedMcpCmdContext();
  if (!authenticatedContext) {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: MCP_CMD_AUTH_REQUIRED_MESSAGE,
        },
        id: null,
      },
      { status: 401 },
    );
  }

  const requestContext = readMcpCmdRequestContext(
    request,
    authenticatedContext,
  );
  const server = createCmdMcpServer(requestContext);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: MCP_CMD_ROUTE_PATH,
      eventName: "mcp_cmd_route_failed",
      action: "handle_mcp_request",
      statusCode: 500,
      error,
      userId: requestContext.userId,
      threadId: requestContext.threadId,
      context: {
        tenantId: requestContext.tenantId,
        principalId: requestContext.principalId,
        turnId: requestContext.turnId,
      },
    });

    return Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error.",
        },
        id: null,
      },
      { status: 500 },
    );
  } finally {
    await Promise.allSettled([transport.close(), server.close()]);
  }
}

function createCmdMcpServer(requestContext: McpCmdRequestContext): McpServer {
  const server = new McpServer({
    name: "local-playground-cmd",
    version: "1.0.0",
  });

  server.registerTool(
    MCP_CMD_TOOL_NAME,
    {
      description: MCP_CMD_TOOL_DESCRIPTION,
      inputSchema: cmdExecuteInputSchema,
    },
    async (args) => {
      const parsedArguments = parseCmdExecuteArguments(args);
      if (!parsedArguments.ok) {
        return buildToolResponse(
          {
            executed: false,
            error: parsedArguments.error,
            threadContext: {
              threadId: requestContext.threadId,
              turnId: requestContext.turnId,
            },
          },
          { isError: true },
        );
      }

      const commandArgs = parsedArguments.value;
      const effectiveThreadId = commandArgs.threadId ?? requestContext.threadId;
      const effectiveRequestContext: McpCmdRequestContext = {
        ...requestContext,
        threadId: effectiveThreadId,
      };

      const directoryScopeResult = resolveWorkingDirectory(
        effectiveRequestContext.userId,
        effectiveRequestContext.threadId,
        commandArgs.workingDirectory,
      );
      if (!directoryScopeResult.ok) {
        return buildToolResponse(
          {
            executed: false,
            error: directoryScopeResult.error,
            threadContext: {
              threadId: effectiveThreadId,
              turnId: requestContext.turnId,
            },
          },
          { isError: true },
        );
      }
      const directoryScope = directoryScopeResult.value;

      const commandSecurityResult = evaluateCommandSecurityPolicy({
        command: commandArgs.command,
      });
      if (!commandSecurityResult.ok) {
        return buildToolResponse(
          {
            executed: false,
            error: commandSecurityResult.error,
            command: commandArgs.command,
            workingDirectory: directoryScope.workingDirectory,
            threadContext: {
              threadId: effectiveThreadId,
              turnId: requestContext.turnId,
            },
          },
          { isError: true },
        );
      }

      const shellExecutionContext = resolveShellExecutionContext();
      if (!shellExecutionContext) {
        return buildToolResponse(
          {
            executed: false,
            error:
              "No available shell environment was found for this operating system. Configure SHELL/ComSpec and retry.",
            threadContext: {
              threadId: effectiveThreadId,
              turnId: requestContext.turnId,
            },
          },
          { isError: true },
        );
      }

      try {
        const executionResult = await runShellCommand({
          shellExecutionContext,
          command: commandArgs.command,
          workingDirectory: directoryScope.workingDirectory,
          environment: buildSecureCommandEnvironment({
            threadDirectory: directoryScope.threadDirectory,
            workingDirectory: directoryScope.workingDirectory,
          }),
          timeoutSeconds: commandArgs.timeoutSeconds,
        });

        return buildToolResponse({
          executed: true,
          command: commandArgs.command,
          workingDirectory: directoryScope.workingDirectory,
          timeoutSeconds: commandArgs.timeoutSeconds,
          threadContext: {
            threadId: effectiveThreadId,
            turnId: requestContext.turnId,
          },
          stdout: executionResult.stdout,
          stderr: executionResult.stderr,
          stdoutTruncated: executionResult.stdoutTruncated,
          stderrTruncated: executionResult.stderrTruncated,
          exitCode: executionResult.exitCode,
          signal: executionResult.signal,
          timedOut: executionResult.timedOut,
          durationMs: executionResult.durationMs,
          shell: {
            executable: shellExecutionContext.executable,
            argsPrefix: shellExecutionContext.argsPrefix,
            family: shellExecutionContext.family,
            source: shellExecutionContext.source,
            platform: process.platform,
          },
        });
      } catch (error) {
        return buildToolResponse(
          {
            executed: false,
            command: commandArgs.command,
            workingDirectory: directoryScope.workingDirectory,
            timeoutSeconds: commandArgs.timeoutSeconds,
            threadContext: {
              threadId: effectiveThreadId,
              turnId: requestContext.turnId,
            },
            shell: {
              executable: shellExecutionContext.executable,
              argsPrefix: shellExecutionContext.argsPrefix,
              family: shellExecutionContext.family,
              source: shellExecutionContext.source,
              platform: process.platform,
            },
            error: `Failed to execute command: ${readErrorMessage(error)}`,
          },
          { isError: true },
        );
      }
    },
  );

  return server;
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

function resolveWorkingDirectory(
  userId: number,
  threadId: string | null,
  workingDirectory: string | null,
): ParseResult<CommandDirectoryScope> {
  if (!threadId) {
    return {
      ok: false,
      error: "threadContext.threadId is required for secure command execution.",
    };
  }

  const threadDirectoryResult = ensureThreadWorkingDirectory(userId, threadId);
  if (!threadDirectoryResult.ok) {
    return threadDirectoryResult;
  }
  const threadDirectory = threadDirectoryResult.value;

  if (!workingDirectory) {
    return {
      ok: true,
      value: {
        threadDirectory,
        workingDirectory: threadDirectory,
      },
    };
  }

  const targetWorkingDirectory = path.isAbsolute(workingDirectory)
    ? path.resolve(workingDirectory)
    : path.resolve(threadDirectory, workingDirectory);
  let stats: fs.Stats;
  try {
    stats = fs.statSync(targetWorkingDirectory);
  } catch {
    return {
      ok: false,
      error: `workingDirectory does not exist: ${targetWorkingDirectory}`,
    };
  }
  if (!stats.isDirectory()) {
    return {
      ok: false,
      error: `workingDirectory must be a directory: ${targetWorkingDirectory}`,
    };
  }

  const workingDirectoryBoundaryResult = isPathWithinThreadDirectoryBoundary(
    targetWorkingDirectory,
    threadDirectory,
  );
  if (!workingDirectoryBoundaryResult.ok) {
    return workingDirectoryBoundaryResult;
  }
  if (!workingDirectoryBoundaryResult.value) {
    return {
      ok: false,
      error: `workingDirectory must be inside thread directory: ${threadDirectory}`,
    };
  }

  return {
    ok: true,
    value: {
      threadDirectory,
      workingDirectory: targetWorkingDirectory,
    },
  };
}

function ensureThreadWorkingDirectory(
  userId: number,
  threadId: string,
): ParseResult<string> {
  let resolved: string;
  try {
    resolved = resolveWorkspaceThreadDirectory({
      workspaceUserId: userId,
      threadId,
    });
  } catch (error) {
    return {
      ok: false,
      error: `Invalid threadContext.threadId: ${readErrorMessage(error)}`,
    };
  }
  try {
    fs.mkdirSync(resolved, { recursive: true });
  } catch (error) {
    return {
      ok: false,
      error: `Failed to prepare default workingDirectory (${resolved}): ${readErrorMessage(error)}`,
    };
  }

  return { ok: true, value: resolved };
}

function evaluateCommandSecurityPolicy(options: {
  command: string;
}): ParseResult<true> {
  const { command } = options;

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
  const executable = path.win32
    .basename(path.posix.basename(trimmed))
    .toLowerCase();
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

function isPathWithinThreadDirectoryBoundary(
  targetPath: string,
  threadDirectory: string,
): ParseResult<boolean> {
  const threadDirectoryRealPathResult = readRealPath(threadDirectory);
  if (!threadDirectoryRealPathResult.ok) {
    return threadDirectoryRealPathResult;
  }

  const existingAncestorResult = readClosestExistingPath(targetPath);
  if (!existingAncestorResult.ok) {
    return existingAncestorResult;
  }
  const existingAncestor = existingAncestorResult.value;
  const ancestorRealPathResult = readRealPath(existingAncestor);
  if (!ancestorRealPathResult.ok) {
    return ancestorRealPathResult;
  }

  const relativeFromAncestor = path.relative(
    path.resolve(existingAncestor),
    path.resolve(targetPath),
  );
  const normalizedTargetFromRealAncestor = path.resolve(
    ancestorRealPathResult.value,
    relativeFromAncestor,
  );

  return {
    ok: true,
    value: isPathInsideBoundary(
      normalizedTargetFromRealAncestor,
      threadDirectoryRealPathResult.value,
    ),
  };
}

function readRealPath(inputPath: string): ParseResult<string> {
  try {
    return {
      ok: true,
      value: path.resolve(fs.realpathSync(inputPath)),
    };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to resolve path '${inputPath}': ${readErrorMessage(error)}`,
    };
  }
}

function readClosestExistingPath(inputPath: string): ParseResult<string> {
  let current = path.resolve(inputPath);
  while (true) {
    if (fs.existsSync(current)) {
      return {
        ok: true,
        value: current,
      };
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return {
        ok: false,
        error: `Unable to resolve an existing ancestor for path '${inputPath}'.`,
      };
    }
    current = parent;
  }
}

function isPathInsideBoundary(
  targetPath: string,
  boundaryPath: string,
): boolean {
  const normalizedBoundary = normalizeComparisonPath(boundaryPath);
  const normalizedTarget = normalizeComparisonPath(targetPath);
  const relative = path.relative(normalizedBoundary, normalizedTarget);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function normalizeComparisonPath(inputPath: string): string {
  const normalized = path.resolve(inputPath);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function resolveShellExecutionContext(): ShellExecutionContext | null {
  const candidates = buildShellCandidates();
  for (const candidate of candidates) {
    if (isShellCandidateAvailable(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildShellCandidates(): ShellExecutionContext[] {
  const candidates: ShellExecutionContext[] = [];
  const seen = new Set<string>();

  const addCandidate = (candidate: ShellExecutionContext) => {
    const executable = candidate.executable.trim();
    if (!executable) {
      return;
    }

    const key = `${candidate.family}:${executable}`.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    candidates.push({
      ...candidate,
      executable,
    });
  };

  const processShell = normalizeOptionalString(process.env.SHELL);
  const userInfoShell = readUserInfoShell();

  if (process.platform === "win32") {
    if (processShell) {
      addCandidate(
        createPosixShellExecutionContext(processShell, "process.env.SHELL"),
      );
    }

    if (userInfoShell) {
      addCandidate(
        createPosixShellExecutionContext(
          userInfoShell,
          "nodeOs.userInfo().shell",
        ),
      );
    }

    addCandidate(createPowerShellExecutionContext("pwsh.exe", "pwsh"));
    addCandidate(
      createPowerShellExecutionContext("powershell.exe", "powershell"),
    );

    const comspec = normalizeOptionalString(process.env.ComSpec);
    if (comspec) {
      addCandidate(
        createCmdShellExecutionContext(comspec, "process.env.ComSpec"),
      );
    }
    addCandidate(createCmdShellExecutionContext("cmd.exe", "default"));

    return candidates;
  }

  if (processShell) {
    addCandidate(
      createPosixShellExecutionContext(processShell, "process.env.SHELL"),
    );
  }

  if (userInfoShell) {
    addCandidate(
      createPosixShellExecutionContext(
        userInfoShell,
        "nodeOs.userInfo().shell",
      ),
    );
  }

  addCandidate(createPosixShellExecutionContext("/bin/bash", "fallback"));
  addCandidate(createPosixShellExecutionContext("/bin/zsh", "fallback"));
  addCandidate(createPosixShellExecutionContext("/bin/sh", "fallback"));
  addCandidate(createPosixShellExecutionContext("bash", "PATH"));
  addCandidate(createPosixShellExecutionContext("zsh", "PATH"));
  addCandidate(createPosixShellExecutionContext("sh", "PATH"));

  return candidates;
}

function createPosixShellExecutionContext(
  executable: string,
  source: string,
): ShellExecutionContext {
  return {
    executable,
    argsPrefix: ["-lc"],
    probeArgs: ["-lc", "exit 0"],
    family: "posix",
    source,
  };
}

function createPowerShellExecutionContext(
  executable: string,
  source: string,
): ShellExecutionContext {
  return {
    executable,
    argsPrefix: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"],
    probeArgs: [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "exit 0",
    ],
    family: "powershell",
    source,
  };
}

function createCmdShellExecutionContext(
  executable: string,
  source: string,
): ShellExecutionContext {
  return {
    executable,
    argsPrefix: ["/d", "/s", "/c"],
    probeArgs: ["/d", "/s", "/c", "exit 0"],
    family: "cmd",
    source,
  };
}

function isShellCandidateAvailable(
  shellExecutionContext: ShellExecutionContext,
): boolean {
  try {
    const probeResult = childProcess.spawnSync(
      shellExecutionContext.executable,
      shellExecutionContext.probeArgs,
      {
        stdio: ["ignore", "ignore", "ignore"],
        windowsHide: true,
        timeout: 1_500,
      },
    );
    if (probeResult.error) {
      return false;
    }

    return probeResult.status === 0;
  } catch {
    return false;
  }
}

async function runShellCommand(options: {
  shellExecutionContext: ShellExecutionContext;
  command: string;
  workingDirectory: string;
  environment: NodeJS.ProcessEnv;
  timeoutSeconds: number;
}): Promise<CommandExecutionResult> {
  const {
    shellExecutionContext,
    command,
    workingDirectory,
    environment,
    timeoutSeconds,
  } = options;

  return await new Promise((resolve, reject) => {
    const stdoutCollector = createOutputCollector();
    const stderrCollector = createOutputCollector();
    let timedOut = false;

    const startedAt = Date.now();
    const child = childProcess.spawn(
      shellExecutionContext.executable,
      [...shellExecutionContext.argsPrefix, command],
      {
        cwd: workingDirectory,
        env: environment,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    child.stdout.on("data", (chunk: Buffer) => {
      appendOutputChunk(stdoutCollector, chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      appendOutputChunk(stderrCollector, chunk);
    });

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill();

      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 1_000);
    }, timeoutSeconds * 1_000);

    child.once("error", (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });

    child.once("close", (exitCode, signal) => {
      clearTimeout(timeoutHandle);
      resolve({
        stdout: readOutputCollectorText(stdoutCollector),
        stderr: readOutputCollectorText(stderrCollector),
        stdoutTruncated: stdoutCollector.truncated,
        stderrTruncated: stderrCollector.truncated,
        exitCode,
        signal,
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

function buildSecureCommandEnvironment(options: {
  threadDirectory: string;
  workingDirectory: string;
}): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value !== "string") {
      continue;
    }
    if (!MCP_CMD_ALLOWED_ENVIRONMENT_KEYS.has(key.toUpperCase())) {
      continue;
    }
    environment[key] = value;
  }

  const processPath = process.env.PATH ?? process.env.Path;
  if (typeof processPath === "string" && processPath.length > 0) {
    environment.PATH = processPath;
  }

  const tempDirectory = path.join(options.threadDirectory, ".tmp");
  const xdgConfigHome = path.join(options.threadDirectory, ".config");
  const xdgCacheHome = path.join(options.threadDirectory, ".cache");
  fs.mkdirSync(tempDirectory, { recursive: true });
  fs.mkdirSync(xdgConfigHome, { recursive: true });
  fs.mkdirSync(xdgCacheHome, { recursive: true });

  environment.HOME = options.threadDirectory;
  environment.USERPROFILE = options.threadDirectory;
  environment.PWD = options.workingDirectory;
  environment.TMPDIR = tempDirectory;
  environment.TMP = tempDirectory;
  environment.TEMP = tempDirectory;
  environment.XDG_CONFIG_HOME = xdgConfigHome;
  environment.XDG_CACHE_HOME = xdgCacheHome;

  return environment;
}

function createOutputCollector(): OutputCollector {
  return {
    chunks: [],
    size: 0,
    truncated: false,
  };
}

function appendOutputChunk(
  collector: OutputCollector,
  chunk: Buffer | string,
): void {
  const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  if (collector.size >= MCP_CMD_OUTPUT_MAX_BYTES) {
    collector.truncated = true;
    return;
  }

  const remaining = MCP_CMD_OUTPUT_MAX_BYTES - collector.size;
  if (bufferChunk.length <= remaining) {
    collector.chunks.push(bufferChunk);
    collector.size += bufferChunk.length;
    return;
  }

  collector.chunks.push(bufferChunk.subarray(0, remaining));
  collector.size = MCP_CMD_OUTPUT_MAX_BYTES;
  collector.truncated = true;
}

function readOutputCollectorText(collector: OutputCollector): string {
  if (collector.chunks.length === 0) {
    return "";
  }

  return Buffer.concat(collector.chunks).toString("utf8");
}

function readMcpCmdRequestContext(
  request: Request,
  authenticatedContext: AuthenticatedMcpCmdContext,
): McpCmdRequestContext {
  return {
    ...authenticatedContext,
    threadId: readOptionalHeaderValue(
      request,
      MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER,
    ),
    turnId: readOptionalHeaderValue(
      request,
      MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER,
    ),
  };
}

async function readAuthenticatedMcpCmdContext(): Promise<AuthenticatedMcpCmdContext | null> {
  const azureContext = await readAzureArmUserContext();
  if (!azureContext) {
    return null;
  }

  const user = await getOrCreateUserByIdentity({
    tenantId: azureContext.tenantId,
    principalId: azureContext.principalId,
  });

  return {
    userId: user.id,
    tenantId: azureContext.tenantId,
    principalId: azureContext.principalId,
  };
}

function readOptionalHeaderValue(
  request: Request,
  headerName: string,
): string | null {
  const raw = request.headers.get(headerName);
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

function readUserInfoShell(): string | null {
  try {
    return normalizeOptionalString(nodeOs.userInfo().shell);
  } catch {
    return null;
  }
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

function buildToolResponse(
  payload: Record<string, unknown>,
  options: {
    isError?: boolean;
    text?: string;
  } = {},
) {
  const text =
    typeof options.text === "string"
      ? options.text
      : JSON.stringify(payload, null, 2);
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
    structuredContent: payload,
    ...(options.isError ? { isError: true } : {}),
  };
}

export const mcpCmdRouteTestUtils = {
  parseCmdExecuteArguments,
  resolveWorkingDirectory,
  resolveShellExecutionContext,
};
