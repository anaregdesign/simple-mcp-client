import nodeOs from "node:os";
import path from "node:path";
import {
  LEGACY_WORKSPACE_STORAGE_DIRECTORY_NAME,
  WORKSPACE_THREADS_DIRECTORY_NAME,
  WORKSPACE_USERS_DIRECTORY_NAME,
  WINDOWS_WORKSPACE_STORAGE_DIRECTORY_NAME,
} from "~/lib/constants/persistence";

type ResolveWorkspaceStorageDirectoryOptions = {
  platform?: NodeJS.Platform;
  homeDirectory?: string;
  appDataDirectory?: string | null;
};

type ResolveWorkspaceUserDirectoryOptions =
  ResolveWorkspaceStorageDirectoryOptions & {
    workspaceUserId: number;
  };

type ResolveWorkspaceThreadDirectoryOptions =
  ResolveWorkspaceUserDirectoryOptions & {
    threadId: string;
  };

export function resolveDefaultFilesystemWorkingDirectory(
  workspaceUserId: number,
  options: ResolveWorkspaceUserDirectoryOptions = {
    workspaceUserId,
  },
): string {
  return resolveWorkspaceUserDirectory({
    ...options,
    workspaceUserId,
  });
}

export function resolveLegacyFilesystemWorkingDirectory(
  options: ResolveWorkspaceStorageDirectoryOptions = {},
): string {
  return resolveWorkspaceStorageDirectory(options);
}

export function resolveThreadFilesystemWorkingDirectory(
  workspaceUserId: number,
  threadId: string,
  options: ResolveWorkspaceThreadDirectoryOptions = {
    workspaceUserId,
    threadId,
  },
): string {
  return resolveWorkspaceThreadDirectory({
    ...options,
    workspaceUserId,
    threadId,
  });
}

function resolveWorkspaceUserDirectory(
  options: ResolveWorkspaceUserDirectoryOptions,
): string {
  const workspaceStorageDirectory = resolveWorkspaceStorageDirectory(options);
  return readPathModule(options.platform).join(
    workspaceStorageDirectory,
    WORKSPACE_USERS_DIRECTORY_NAME,
    readWorkspaceUserDirectoryName(options.workspaceUserId),
  );
}

function resolveWorkspaceThreadDirectory(
  options: ResolveWorkspaceThreadDirectoryOptions,
): string {
  const workspaceUserDirectory = resolveWorkspaceUserDirectory(options);
  return readPathModule(options.platform).join(
    workspaceUserDirectory,
    WORKSPACE_THREADS_DIRECTORY_NAME,
    readWorkspaceThreadDirectoryName(options.threadId),
  );
}

function resolveWorkspaceStorageDirectory(
  options: ResolveWorkspaceStorageDirectoryOptions = {},
): string {
  const platform = options.platform ?? process.platform;
  const homeDirectory = options.homeDirectory ?? nodeOs.homedir();

  if (platform === "win32") {
    const appDataDirectory = (
      options.appDataDirectory ??
      process.env.APPDATA ??
      ""
    ).trim();
    if (!appDataDirectory) {
      return path.win32.join(
        homeDirectory,
        LEGACY_WORKSPACE_STORAGE_DIRECTORY_NAME,
      );
    }

    return path.win32.join(
      appDataDirectory,
      WINDOWS_WORKSPACE_STORAGE_DIRECTORY_NAME,
    );
  }

  return path.posix.join(
    homeDirectory,
    LEGACY_WORKSPACE_STORAGE_DIRECTORY_NAME,
  );
}

function readWorkspaceUserDirectoryName(workspaceUserId: number): string {
  if (!Number.isInteger(workspaceUserId) || workspaceUserId <= 0) {
    throw new Error("`workspaceUserId` must be a positive integer.");
  }

  return String(workspaceUserId);
}

function readWorkspaceThreadDirectoryName(threadId: string): string {
  const normalizedThreadId = threadId.trim();
  if (!normalizedThreadId) {
    throw new Error("`threadId` must be a non-empty string.");
  }

  if (normalizedThreadId.includes("/") || normalizedThreadId.includes("\\")) {
    throw new Error("`threadId` must not contain path separators.");
  }

  return normalizedThreadId;
}

function readPathModule(platform: NodeJS.Platform | undefined) {
  return (platform ?? process.platform) === "win32" ? path.win32 : path.posix;
}
