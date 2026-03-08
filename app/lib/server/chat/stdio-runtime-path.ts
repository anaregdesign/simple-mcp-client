/**
 * Helpers for stdio command path resolution in chat runtime.
 */
import childProcess from "node:child_process";
import fs from "node:fs";
import nodeOs from "node:os";
import path from "node:path";

type EnvironmentMap = NodeJS.ProcessEnv | Record<string, string>;

const shellPathStartMarker = "__LOCAL_PLAYGROUND_PATH_START__";
const shellPathEndMarker = "__LOCAL_PLAYGROUND_PATH_END__";
let cachedShellExecutablePathEntries: string[] | null = null;
let cachedRuntimeExecutablePathEntries: string[] | null = null;

export function buildStdioSpawnEnvironment(
  configuredEnv: Record<string, string>,
): Record<string, string> {
  const base = { ...configuredEnv };
  const pathKey = readPathEnvironmentKeyFromMap(process.env);
  const configuredPath = readPathEnvironmentValue(base);
  const processPath = readPathEnvironmentValue(process.env);
  const mergedPathEntries = dedupePathEntries([
    ...splitPathEntries(configuredPath),
    ...splitPathEntries(processPath),
    ...resolveRuntimeExecutablePathEntries(),
  ]);
  if (mergedPathEntries.length === 0) {
    return base;
  }

  const pathValue = mergedPathEntries.join(path.delimiter);
  const result: Record<string, string> = {
    ...base,
    [pathKey]: pathValue,
  };
  if (pathKey !== "PATH") {
    result.PATH = pathValue;
  }
  return result;
}

export function resolveExecutableCommand(command: string, env: Record<string, string>): string {
  if (isPathLikeCommand(command)) {
    return command;
  }

  const pathValue = readPathEnvironmentValue(env) || readPathEnvironmentValue(process.env);
  if (!pathValue) {
    return command;
  }

  const resolved = findExecutableInPath(command, pathValue, env);
  return resolved ?? command;
}

function isPathLikeCommand(command: string): boolean {
  return command.includes("/") || command.includes("\\");
}

function findExecutableInPath(
  command: string,
  pathValue: string,
  env: Record<string, string>,
): string | null {
  const pathEntries = splitPathEntries(pathValue);
  if (pathEntries.length === 0) {
    return null;
  }

  const extCandidates = buildExecutableExtensions(command, env);
  for (const directory of pathEntries) {
    for (const extension of extCandidates) {
      const candidate = path.join(directory, `${command}${extension}`);
      if (isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function buildExecutableExtensions(command: string, env: Record<string, string>): string[] {
  if (process.platform !== "win32") {
    return [""];
  }

  if (path.extname(command)) {
    return [""];
  }

  const raw = env.PATHEXT ?? process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM";
  const extensions = raw
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => (entry.startsWith(".") ? entry : `.${entry}`));
  return extensions.length > 0 ? extensions : [".EXE", ".CMD", ".BAT", ".COM"];
}

function isExecutableFile(filePath: string): boolean {
  try {
    fs.accessSync(filePath, process.platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveRuntimeExecutablePathEntries(): string[] {
  if (cachedRuntimeExecutablePathEntries) {
    return cachedRuntimeExecutablePathEntries;
  }

  const resolved = dedupePathEntries([
    ...resolveShellExecutablePathEntries(),
    ...resolveAdditionalExecutablePathEntries(),
  ]);
  cachedRuntimeExecutablePathEntries = resolved;
  return resolved;
}

function resolveShellExecutablePathEntries(): string[] {
  if (cachedShellExecutablePathEntries) {
    return cachedShellExecutablePathEntries;
  }

  if (process.platform === "win32") {
    cachedShellExecutablePathEntries = [];
    return cachedShellExecutablePathEntries;
  }

  const shellPath =
    (typeof process.env.SHELL === "string" ? process.env.SHELL.trim() : "") ||
    (() => {
      try {
        return nodeOs.userInfo().shell?.trim() ?? "";
      } catch {
        return "";
      }
    })();

  if (!shellPath) {
    cachedShellExecutablePathEntries = [];
    return cachedShellExecutablePathEntries;
  }

  const command = `printf "%s%s%s" "${shellPathStartMarker}" "$PATH" "${shellPathEndMarker}"`;
  const interactiveLoginEntries = readShellExecutablePathEntries(shellPath, ["-i", "-l", "-c", command]);
  cachedShellExecutablePathEntries =
    interactiveLoginEntries.length > 0
      ? interactiveLoginEntries
      : readShellExecutablePathEntries(shellPath, ["-l", "-c", command]);

  return cachedShellExecutablePathEntries;
}

function readShellExecutablePathEntries(shellPath: string, args: string[]): string[] {
  try {
    const result = childProcess.spawnSync(shellPath, args, {
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 4_000,
      maxBuffer: 512 * 1_024,
    });
    if (result.error || result.status !== 0) {
      return [];
    }

    const output = typeof result.stdout === "string" ? result.stdout : "";
    const start = output.indexOf(shellPathStartMarker);
    const end = output.indexOf(shellPathEndMarker, start + shellPathStartMarker.length);
    if (start < 0 || end < 0) {
      return [];
    }

    const shellPathValue = output
      .slice(start + shellPathStartMarker.length, end)
      .trim();
    return splitPathEntries(shellPathValue);
  } catch {
    return [];
  }
}

function resolveAdditionalExecutablePathEntries(): string[] {
  if (process.platform === "win32") {
    const programFilesEntries = [
      typeof process.env.ProgramFiles === "string" ? process.env.ProgramFiles : "",
      typeof process.env["ProgramFiles(x86)"] === "string" ? process.env["ProgramFiles(x86)"] : "",
    ]
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return dedupePathEntries(programFilesEntries.map((entry) => path.join(entry, "nodejs")));
  }

  const homeDirectory = nodeOs.homedir();
  const entries = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  if (homeDirectory) {
    entries.push(
      path.join(homeDirectory, ".local", "bin"),
      path.join(homeDirectory, ".volta", "bin"),
      path.join(homeDirectory, ".asdf", "shims"),
      path.join(homeDirectory, ".bun", "bin"),
      path.join(homeDirectory, ".npm-global", "bin"),
    );
  }

  return entries;
}

function splitPathEntries(pathValue: string): string[] {
  return pathValue
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function dedupePathEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const entry of entries) {
    if (!entry || seen.has(entry)) {
      continue;
    }

    seen.add(entry);
    deduped.push(entry);
  }
  return deduped;
}

function readPathEnvironmentValue(env: EnvironmentMap): string {
  const key = readPathEnvironmentKeyFromMap(env);
  const value = env[key];
  return typeof value === "string" ? value : "";
}

function readPathEnvironmentKeyFromMap(env: EnvironmentMap): string {
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === "PATH") {
      return key;
    }
  }

  return "PATH";
}
