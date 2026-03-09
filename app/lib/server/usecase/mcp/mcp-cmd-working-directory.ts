import fs from "node:fs";
import path from "node:path";
import { resolveThreadFilesystemWorkingDirectory } from "./workspace-mcp-server-default-paths";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type CommandDirectoryScope = {
  threadDirectory: string;
  workingDirectory: string;
};

export function resolveWorkingDirectory(
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
    resolved = resolveThreadFilesystemWorkingDirectory(userId, threadId);
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

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
