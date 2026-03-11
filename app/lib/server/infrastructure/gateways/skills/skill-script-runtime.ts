import childProcess from "node:child_process";
import nodeFsPromises from "node:fs/promises";
import nodeOs from "node:os";
import path from "node:path";
import {
  AGENT_SKILL_SCRIPT_ARG_MAX_LENGTH,
  AGENT_SKILL_SCRIPT_MAX_ARGS,
  AGENT_SKILL_SCRIPT_OUTPUT_MAX_CHARS,
  AGENT_SKILL_SCRIPT_TIMEOUT_MAX_MS,
  AGENT_SKILL_SCRIPT_TIMEOUT_MS,
} from "~/lib/constants/skills";
import { resolveSkillResourceFilePath } from "~/lib/server/infrastructure/gateways/skills/skill-resource-runtime";

export type SkillScriptRunOptions = {
  skillRoot: string;
  relativePath: string;
  args: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
  outputMaxChars?: number;
};

export type SkillScriptRunResult = {
  command: string[];
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  environmentChanges: {
    captured: boolean;
    updated: Record<string, string>;
    removed: string[];
  };
};

export async function runSkillScript(
  options: SkillScriptRunOptions,
): Promise<SkillScriptRunResult> {
  const scriptPath = await resolveSkillResourceFilePath(
    options.skillRoot,
    "scripts",
    options.relativePath,
  );
  const scriptArgs = normalizeScriptArgs(options.args);
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const outputMaxChars = normalizeOutputMaxChars(options.outputMaxChars);
  const baseEnvironment = normalizeProcessEnvironment(options.env);
  const command = resolveScriptCommand(scriptPath, scriptArgs);

  if (command.captureEnvironment === "bash") {
    return await runProcessWithShellEnvironmentCapture({
      scriptPath,
      scriptArgs,
      sourceEntrypointFunction: command.sourceEntrypointFunction,
      cwd: path.resolve(options.skillRoot),
      env: baseEnvironment,
      timeoutMs,
      outputMaxChars,
    });
  }

  if (command.captureEnvironment === "pwsh") {
    return await runProcessWithPowerShellEnvironmentCapture({
      scriptPath,
      scriptArgs,
      cwd: path.resolve(options.skillRoot),
      env: baseEnvironment,
      timeoutMs,
      outputMaxChars,
    });
  }

  if (command.captureEnvironment === "cmd") {
    return await runProcessWithWindowsCommandEnvironmentCapture({
      scriptPath,
      scriptArgs,
      cwd: path.resolve(options.skillRoot),
      env: baseEnvironment,
      timeoutMs,
      outputMaxChars,
    });
  }

  return await runProcess({
    command: command.command,
    args: command.args,
    cwd: path.resolve(options.skillRoot),
    env: baseEnvironment,
    timeoutMs,
    outputMaxChars,
  });
}

function normalizeScriptArgs(value: string[]): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Script args must be an array.");
  }

  if (value.length > AGENT_SKILL_SCRIPT_MAX_ARGS) {
    throw new Error(
      `Script args must include at most ${AGENT_SKILL_SCRIPT_MAX_ARGS} items.`,
    );
  }

  const result: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string") {
      throw new Error(`Script arg at index ${index} must be a string.`);
    }

    if (entry.length > AGENT_SKILL_SCRIPT_ARG_MAX_LENGTH) {
      throw new Error(
        `Script arg at index ${index} must be ${AGENT_SKILL_SCRIPT_ARG_MAX_LENGTH} characters or fewer.`,
      );
    }

    result.push(entry);
  }

  return result;
}

function normalizeTimeoutMs(value: number | undefined): number {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || !value || value <= 0) {
    return AGENT_SKILL_SCRIPT_TIMEOUT_MS;
  }

  return Math.min(Math.max(1, value), AGENT_SKILL_SCRIPT_TIMEOUT_MAX_MS);
}

function normalizeOutputMaxChars(value: number | undefined): number {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || !value || value <= 0) {
    return AGENT_SKILL_SCRIPT_OUTPUT_MAX_CHARS;
  }

  return Math.max(128, value);
}

function resolveScriptCommand(
  scriptPath: string,
  scriptArgs: string[],
): {
  command: string;
  args: string[];
  captureEnvironment: false | "bash" | "pwsh" | "cmd";
  sourceEntrypointFunction?: string;
} {
  const extension = path.extname(scriptPath).toLowerCase();

  if (extension === ".js" || extension === ".mjs" || extension === ".cjs") {
    return {
      command: process.execPath,
      args: [scriptPath, ...scriptArgs],
      captureEnvironment: false,
    };
  }

  if (extension === ".py") {
    return {
      command: process.platform === "win32" ? "python" : "python3",
      args: [scriptPath, ...scriptArgs],
      captureEnvironment: false,
    };
  }

  if (extension === ".sh" || extension === ".bash") {
    return {
      command: "bash",
      args: [scriptPath, ...scriptArgs],
      captureEnvironment: "bash",
      sourceEntrypointFunction:
        extension === ".bash"
          ? deriveShellScriptEntrypointFunctionName(scriptPath)
          : undefined,
    };
  }

  if (extension === ".ps1") {
    return {
      command: readDefaultPowerShellCommandPath(),
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...scriptArgs],
      captureEnvironment: "pwsh",
    };
  }

  if (extension === ".cmd" || extension === ".bat") {
    if (process.platform === "win32") {
      return {
        command: readDefaultCmdCommandPath(),
        args: ["/d", "/s", "/c", scriptPath, ...scriptArgs],
        captureEnvironment: "cmd",
      };
    }
  }

  return {
    command: scriptPath,
    args: scriptArgs,
    captureEnvironment: false,
  };
}

function deriveShellScriptEntrypointFunctionName(
  scriptPath: string,
): string | undefined {
  const rawBaseName = path.basename(scriptPath, path.extname(scriptPath));
  if (!rawBaseName) {
    return undefined;
  }

  const normalizedBaseName = rawBaseName.replace(/[^A-Za-z0-9_]/g, "_");
  if (!normalizedBaseName) {
    return undefined;
  }

  if (/^[0-9]/.test(normalizedBaseName)) {
    return `_${normalizedBaseName}`;
  }

  return normalizedBaseName;
}

async function runProcess(options: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  outputMaxChars: number;
}): Promise<SkillScriptRunResult> {
  const child = childProcess.spawn(options.command, options.args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let truncated = false;
  let timedOut = false;

  const recordOutput = (target: "stdout" | "stderr", chunk: string) => {
    if (!chunk) {
      return;
    }

    const previousValue = target === "stdout" ? stdout : stderr;
    const nextValue = appendLimited(previousValue, chunk, options.outputMaxChars);
    if (nextValue.truncated) {
      truncated = true;
    }

    if (target === "stdout") {
      stdout = nextValue.value;
      return;
    }

    stderr = nextValue.value;
  };

  if (child.stdout) {
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      recordOutput("stdout", chunk);
    });
  }

  if (child.stderr) {
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      recordOutput("stderr", chunk);
    });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, options.timeoutMs);

  try {
    const completion = await new Promise<{
      exitCode: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (exitCode, signal) => {
        resolve({
          exitCode,
          signal,
        });
      });
    });

    return {
      command: [options.command, ...options.args],
      exitCode: completion.exitCode,
      signal: completion.signal,
      stdout,
      stderr,
      timedOut,
      truncated,
      environmentChanges: {
        captured: false,
        updated: {},
        removed: [],
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function appendLimited(
  existing: string,
  next: string,
  maxChars: number,
): {
  value: string;
  truncated: boolean;
} {
  if (existing.length >= maxChars) {
    return {
      value: existing,
      truncated: true,
    };
  }

  const remainingChars = maxChars - existing.length;
  if (next.length <= remainingChars) {
    return {
      value: `${existing}${next}`,
      truncated: false,
    };
  }

  return {
    value: `${existing}${next.slice(0, remainingChars)}`,
    truncated: true,
  };
}

function normalizeProcessEnvironment(
  value: Record<string, string> | undefined,
): NodeJS.ProcessEnv {
  const normalized: NodeJS.ProcessEnv = {};
  const source = value ?? process.env;
  for (const [key, entry] of Object.entries(source)) {
    if (typeof entry === "string") {
      normalized[key] = entry;
    }
  }

  return normalized;
}

async function runProcessWithShellEnvironmentCapture(options: {
  scriptPath: string;
  scriptArgs: string[];
  sourceEntrypointFunction?: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  outputMaxChars: number;
}): Promise<SkillScriptRunResult> {
  const tempDirectory = await nodeFsPromises.mkdtemp(
    path.join(nodeOs.tmpdir(), "local-playground-skill-env-"),
  );
  const environmentSnapshotPath = path.join(tempDirectory, "environment.snapshot");
  const wrapperPath = path.join(tempDirectory, "capture-env.sh");

  const wrapperScript = [
    "#!/usr/bin/env bash",
    "__local_playground_capture_env() {",
    '  if [[ -n "${LOCAL_PLAYGROUND_ENV_CAPTURE_FILE:-}" ]]; then',
    '    env -0 > "${LOCAL_PLAYGROUND_ENV_CAPTURE_FILE}" 2>/dev/null || true',
    "  fi",
    "}",
    "trap __local_playground_capture_env EXIT",
    "set +e",
    'script_path="$1"',
    "shift",
    'entrypoint="${LOCAL_PLAYGROUND_SCRIPT_ENTRYPOINT:-}"',
    'if [[ -n "$entrypoint" ]]; then',
    '  source "$script_path"',
    '  if declare -F "$entrypoint" >/dev/null 2>&1; then',
    '    "$entrypoint" "$@"',
    "    exit $?",
    "  fi",
    "fi",
    'source "$script_path" "$@"',
    "exit $?",
    "",
  ].join("\n");

  await nodeFsPromises.writeFile(wrapperPath, wrapperScript, {
    encoding: "utf8",
    mode: 0o700,
  });

  try {
    const runtimeEnvironment = {
      ...options.env,
      LOCAL_PLAYGROUND_ENV_CAPTURE_FILE: environmentSnapshotPath,
      ...(options.sourceEntrypointFunction
        ? { LOCAL_PLAYGROUND_SCRIPT_ENTRYPOINT: options.sourceEntrypointFunction }
        : {}),
    };
    const result = await runProcess({
      command: process.platform === "win32" ? "bash" : readDefaultBashCommandPath(),
      args: [wrapperPath, options.scriptPath, ...options.scriptArgs],
      cwd: options.cwd,
      env: runtimeEnvironment,
      timeoutMs: options.timeoutMs,
      outputMaxChars: options.outputMaxChars,
    });

    const capturedEnvironment = await readCapturedEnvironmentSnapshot(
      environmentSnapshotPath,
    );
    if (!capturedEnvironment) {
      return result;
    }

    const environmentChanges = readEnvironmentChanges(options.env, capturedEnvironment);
    return {
      ...result,
      environmentChanges: {
        captured: true,
        ...environmentChanges,
      },
    };
  } finally {
    await nodeFsPromises.rm(tempDirectory, {
      recursive: true,
      force: true,
    });
  }
}

function readDefaultBashCommandPath(): string {
  const configured =
    typeof process.env.BASH === "string" ? process.env.BASH.trim() : "";
  return configured || "/bin/bash";
}

function readDefaultPowerShellCommandPath(): string {
  const configuredPwsh =
    typeof process.env.PWSH === "string" ? process.env.PWSH.trim() : "";
  if (configuredPwsh) {
    return configuredPwsh;
  }

  const configuredPowerShell =
    typeof process.env.POWERSHELL === "string"
      ? process.env.POWERSHELL.trim()
      : "";
  if (configuredPowerShell) {
    return configuredPowerShell;
  }

  return process.platform === "win32" ? "powershell.exe" : "pwsh";
}

function readDefaultCmdCommandPath(): string {
  const configuredComSpec =
    typeof process.env.ComSpec === "string" ? process.env.ComSpec.trim() : "";
  if (configuredComSpec) {
    return configuredComSpec;
  }

  const configuredComspec =
    typeof process.env.COMSPEC === "string" ? process.env.COMSPEC.trim() : "";
  if (configuredComspec) {
    return configuredComspec;
  }

  const configuredSystemRoot =
    typeof process.env.SystemRoot === "string"
      ? process.env.SystemRoot.trim()
      : "";
  if (configuredSystemRoot) {
    return path.join(configuredSystemRoot, "System32", "cmd.exe");
  }

  return "cmd.exe";
}

async function runProcessWithPowerShellEnvironmentCapture(options: {
  scriptPath: string;
  scriptArgs: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  outputMaxChars: number;
}): Promise<SkillScriptRunResult> {
  const tempDirectory = await nodeFsPromises.mkdtemp(
    path.join(nodeOs.tmpdir(), "local-playground-skill-env-"),
  );
  const environmentSnapshotPath = path.join(tempDirectory, "environment.snapshot");
  const wrapperPath = path.join(tempDirectory, "capture-env.ps1");

  const wrapperScript = [
    "param(",
    "  [Parameter(Mandatory = $true)][string]$ScriptPath,",
    "  [Parameter(Mandatory = $true)][string]$CaptureFile,",
    "  [string[]]$ScriptArgs",
    ")",
    '$ErrorActionPreference = "Continue"',
    "$scriptExitCode = 0",
    "try {",
    "  . $ScriptPath @ScriptArgs",
    "  if ($LASTEXITCODE -is [int]) {",
    "    $scriptExitCode = [int]$LASTEXITCODE",
    "  }",
    "} catch {",
    "  Write-Error $_",
    "  $scriptExitCode = 1",
    "} finally {",
    "  try {",
    "    $pairs = New-Object System.Collections.Generic.List[string]",
    "    Get-ChildItem Env: | ForEach-Object {",
    '      $pairs.Add("$($_.Name)=$($_.Value)")',
    "    }",
    '    $text = [string]::Join(\"`0\", $pairs) + \"`0\"',
    "    [System.IO.File]::WriteAllBytes(",
    "      $CaptureFile,",
    "      [System.Text.Encoding]::UTF8.GetBytes($text)",
    "    )",
    "  } catch {",
    "    # Best effort capture.",
    "  }",
    "}",
    "exit $scriptExitCode",
    "",
  ].join("\n");

  await nodeFsPromises.writeFile(wrapperPath, wrapperScript, {
    encoding: "utf8",
    mode: 0o700,
  });

  try {
    const result = await runProcess({
      command: readDefaultPowerShellCommandPath(),
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        wrapperPath,
        options.scriptPath,
        environmentSnapshotPath,
        ...options.scriptArgs,
      ],
      cwd: options.cwd,
      env: options.env,
      timeoutMs: options.timeoutMs,
      outputMaxChars: options.outputMaxChars,
    });

    const capturedEnvironment = await readCapturedEnvironmentSnapshot(
      environmentSnapshotPath,
    );
    if (!capturedEnvironment) {
      return result;
    }

    const environmentChanges = readEnvironmentChanges(options.env, capturedEnvironment);
    return {
      ...result,
      environmentChanges: {
        captured: true,
        ...environmentChanges,
      },
    };
  } finally {
    await nodeFsPromises.rm(tempDirectory, {
      recursive: true,
      force: true,
    });
  }
}

async function runProcessWithWindowsCommandEnvironmentCapture(options: {
  scriptPath: string;
  scriptArgs: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  outputMaxChars: number;
}): Promise<SkillScriptRunResult> {
  const tempDirectory = await nodeFsPromises.mkdtemp(
    path.join(nodeOs.tmpdir(), "local-playground-skill-env-"),
  );
  const environmentSnapshotPath = path.join(tempDirectory, "environment.snapshot");
  const wrapperPath = path.join(tempDirectory, "capture-env.cmd");

  const wrapperScript = [
    "@echo off",
    "setlocal enableextensions",
    'set "__LOCAL_PLAYGROUND_SCRIPT=%~1"',
    "shift",
    'if not defined __LOCAL_PLAYGROUND_SCRIPT exit /b 1',
    'call "%__LOCAL_PLAYGROUND_SCRIPT%" %*',
    'set "__LOCAL_PLAYGROUND_SCRIPT_EXIT_CODE=%ERRORLEVEL%"',
    "if defined LOCAL_PLAYGROUND_ENV_CAPTURE_FILE (",
    '  >"%LOCAL_PLAYGROUND_ENV_CAPTURE_FILE%" set',
    ")",
    "exit /b %__LOCAL_PLAYGROUND_SCRIPT_EXIT_CODE%",
    "",
  ].join("\r\n");

  await nodeFsPromises.writeFile(wrapperPath, wrapperScript, {
    encoding: "utf8",
    mode: 0o700,
  });

  try {
    const result = await runProcess({
      command: readDefaultCmdCommandPath(),
      args: ["/d", "/s", "/c", wrapperPath, options.scriptPath, ...options.scriptArgs],
      cwd: options.cwd,
      env: {
        ...options.env,
        LOCAL_PLAYGROUND_ENV_CAPTURE_FILE: environmentSnapshotPath,
      },
      timeoutMs: options.timeoutMs,
      outputMaxChars: options.outputMaxChars,
    });

    const capturedEnvironment = await readCapturedEnvironmentSnapshot(
      environmentSnapshotPath,
    );
    if (!capturedEnvironment) {
      return result;
    }

    const environmentChanges = readEnvironmentChanges(options.env, capturedEnvironment);
    return {
      ...result,
      environmentChanges: {
        captured: true,
        ...environmentChanges,
      },
    };
  } finally {
    await nodeFsPromises.rm(tempDirectory, {
      recursive: true,
      force: true,
    });
  }
}

async function readCapturedEnvironmentSnapshot(
  snapshotPath: string,
): Promise<Record<string, string> | null> {
  try {
    const raw = await nodeFsPromises.readFile(snapshotPath, "utf8");
    const entries = raw.includes("\0") ? raw.split("\0") : raw.split(/\r?\n/);
    const environment: Record<string, string> = {};
    for (const entry of entries) {
      if (!entry) {
        continue;
      }

      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = entry.slice(0, separatorIndex);
      const value = entry.slice(separatorIndex + 1);
      if (key) {
        environment[key] = value;
      }
    }

    return environment;
  } catch {
    return null;
  }
}

function readEnvironmentChanges(
  previous: NodeJS.ProcessEnv,
  next: Record<string, string>,
): {
  updated: Record<string, string>;
  removed: string[];
} {
  const updated: Record<string, string> = {};
  for (const [key, nextValue] of Object.entries(next)) {
    if (shouldIgnoreEnvironmentChangeKey(key)) {
      continue;
    }

    const previousValue = previous[key];
    if (typeof previousValue === "string" && previousValue === nextValue) {
      continue;
    }

    updated[key] = nextValue;
  }

  const removed: string[] = [];
  for (const [key, previousValue] of Object.entries(previous)) {
    if (typeof previousValue !== "string" || shouldIgnoreEnvironmentChangeKey(key)) {
      continue;
    }

    if (!(key in next)) {
      removed.push(key);
    }
  }

  return {
    updated,
    removed,
  };
}

function shouldIgnoreEnvironmentChangeKey(key: string): boolean {
  if (!key || key.startsWith("BASH_") || key.startsWith("__LOCAL_PLAYGROUND_")) {
    return true;
  }

  return (
    key === "LOCAL_PLAYGROUND_ENV_CAPTURE_FILE" ||
    key === "LOCAL_PLAYGROUND_SCRIPT_ENTRYPOINT" ||
    key === "PSExecutionPolicyPreference" ||
    key === "CD" ||
    key === "_" ||
    key === "PWD" ||
    key === "OLDPWD" ||
    key === "SHLVL" ||
    key === "SHELLOPTS" ||
    key === "BASHOPTS" ||
    key === "BASHPID" ||
    key === "PPID" ||
    key === "EUID" ||
    key === "UID"
  );
}
