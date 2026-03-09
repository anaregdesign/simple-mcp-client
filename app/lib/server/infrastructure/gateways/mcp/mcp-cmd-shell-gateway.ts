import childProcess from "node:child_process";
import fs from "node:fs";
import nodeOs from "node:os";
import path from "node:path";
import type {
  CommandExecutionResult,
  McpCmdShell,
  McpCmdShellGateway,
  ShellFamily,
} from "~/lib/server/usecase/mcp/mcp-cmd-service";

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

const MCP_CMD_OUTPUT_MAX_BYTES = 1_000_000;

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

type ShellCommandResult = Omit<CommandExecutionResult, "shell">;

export class NodeMcpCmdShellGateway implements McpCmdShellGateway {
  async executeCommand(options: {
    command: string;
    threadDirectory: string;
    workingDirectory: string;
    timeoutSeconds: number;
  }): Promise<
    { ok: true; value: CommandExecutionResult } |
    { ok: false; error: string; shell?: McpCmdShell }
  > {
    const shellExecutionContext = resolveShellExecutionContext();
    if (!shellExecutionContext) {
      return {
        ok: false,
        error:
          "No available shell environment was found for this operating system. Configure SHELL/ComSpec and retry.",
      };
    }

    const shell = readShellMetadata(shellExecutionContext);

    try {
      const executionResult = await runShellCommand({
        shellExecutionContext,
        command: options.command,
        workingDirectory: options.workingDirectory,
        environment: buildSecureCommandEnvironment({
          threadDirectory: options.threadDirectory,
          workingDirectory: options.workingDirectory,
        }),
        timeoutSeconds: options.timeoutSeconds,
      });

      return {
        ok: true,
        value: {
          ...executionResult,
          shell,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: `Failed to execute command: ${readErrorMessage(error)}`,
        shell,
      };
    }
  }
}

function readShellMetadata(shellExecutionContext: ShellExecutionContext): McpCmdShell {
  return {
    executable: shellExecutionContext.executable,
    argsPrefix: shellExecutionContext.argsPrefix,
    family: shellExecutionContext.family,
    source: shellExecutionContext.source,
    platform: process.platform,
  };
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
}): Promise<ShellCommandResult> {
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

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
