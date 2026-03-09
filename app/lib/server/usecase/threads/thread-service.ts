/**
 * Thread application service module.
 */
import { THREAD_DEFAULT_NAME } from "~/lib/constants/chat";
import { THREAD_NAME_MAX_LENGTH } from "~/lib/constants/client";
import { SKILL_REGISTRY_OPTIONS } from "~/lib/contracts/skills/registry";
import { hasThreadPersistableState } from "~/lib/contracts/threads/state";
import type { ThreadResource, ThreadWritePayload } from "~/lib/contracts/threads/types";
import {
  ensurePersistenceDatabaseReady,
  prisma,
} from "~/lib/server/infrastructure/persistence/prisma";
import {
  buildThreadMessageSkillActivationRowId,
  buildThreadMcpServerRowId,
  buildThreadOperationLogRowId,
  buildThreadSkillActivationRowId,
} from "~/lib/server/shared/thread-row-ids";

const threadResourceInclude = {
  instruction: true,
  messages: {
    orderBy: {
      conversationOrder: "asc",
    },
    include: {
      skillActivations: {
        orderBy: {
          selectionOrder: "asc",
        },
        include: {
          skillProfile: true,
        },
      },
    },
  },
  mcpServers: {
    orderBy: {
      selectionOrder: "asc",
    },
  },
  mcpRpcLogs: {
    orderBy: {
      conversationOrder: "asc",
    },
  },
  skillSelections: {
    orderBy: {
      selectionOrder: "asc",
    },
    include: {
      skillProfile: true,
    },
  },
} as const;

export class ThreadQueryService {
  async readUserThreads(userId: number): Promise<ThreadResource[]> {
    return readUserThreads(userId);
  }
}

export class ThreadApplicationService {
  async createThread(
    userId: number,
    payload: ThreadWritePayload,
  ): Promise<CreateThreadResult> {
    return createThread(userId, payload);
  }

  async updateThread(
    userId: number,
    payload: ThreadWritePayload,
  ): Promise<UpdateThreadResult> {
    return updateThread(userId, payload);
  }

  async logicalDeleteThread(
    userId: number,
    threadId: string,
  ): Promise<LogicalDeleteThreadResult> {
    return logicalDeleteThread(userId, threadId);
  }

  async logicalRestoreThread(
    userId: number,
    threadId: string,
  ): Promise<LogicalRestoreThreadResult> {
    return logicalRestoreThread(userId, threadId);
  }
}

export const threadQueryService = new ThreadQueryService();
export const threadApplicationService = new ThreadApplicationService();

async function readUserThreads(userId: number): Promise<ThreadResource[]> {
  await ensurePersistenceDatabaseReady();

  return prisma.thread.findMany({
    where: {
      userId,
    },
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    include: threadResourceInclude,
  });
}

async function readThreadById(
  userId: number,
  threadId: string,
): Promise<ThreadResource | null> {
  await ensurePersistenceDatabaseReady();

  return prisma.thread.findFirst({
    where: {
      id: threadId,
      userId,
    },
    include: threadResourceInclude,
  });
}

type ThreadRecordHead = {
  deletedAt: string | null;
};

export type CreateThreadResult =
  | {
      status: "created";
      thread: ThreadResource;
    }
  | {
      status: "conflict";
    }
  | {
      status: "invalid";
    };

async function readThreadRecordHead(
  userId: number,
  threadId: string,
): Promise<ThreadRecordHead | null> {
  await ensurePersistenceDatabaseReady();

  return prisma.thread.findFirst({
    where: {
      id: threadId,
      userId,
    },
    select: {
      deletedAt: true,
    },
  });
}

export async function createThread(
  userId: number,
  payload: ThreadWritePayload,
): Promise<CreateThreadResult> {
  const existing = await readThreadRecordHead(userId, payload.id);
  if (existing) {
    return {
      status: "conflict",
    };
  }

  try {
    const saved = await saveThreadPayload(userId, payload);
    if (!saved || !saved.created) {
      return {
        status: "invalid",
      };
    }

    return {
      status: "created",
      thread: saved.thread,
    };
  } catch (error) {
    if (isThreadIdConflictError(error)) {
      return {
        status: "conflict",
      };
    }
    throw error;
  }
}

export type UpdateThreadResult =
  | {
      status: "ok";
      thread: ThreadResource;
    }
  | {
      status: "not_found";
    }
  | {
      status: "archived";
    };

export async function updateThread(
  userId: number,
  payload: ThreadWritePayload,
): Promise<UpdateThreadResult> {
  const existing = await readThreadRecordHead(userId, payload.id);
  if (!existing) {
    return { status: "not_found" };
  }
  if (existing.deletedAt !== null) {
    return { status: "archived" };
  }

  const saved = await saveThreadPayload(userId, payload);
  if (!saved || saved.created) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    thread: saved.thread,
  };
}

export async function saveThreadPayload(
  userId: number,
  payload: ThreadWritePayload,
): Promise<{ thread: ThreadResource; created: boolean } | null> {
  await ensurePersistenceDatabaseReady();
  let created = false;

  let existing = await prisma.thread.findFirst({
    where: {
      id: payload.id,
      userId,
    },
    select: {
      id: true,
      name: true,
      deletedAt: true,
    },
  });

  if (!existing) {
    if (!hasThreadPersistableState(payload)) {
      return null;
    }
    created = true;

    const now = new Date().toISOString();
    const createdAt = payload.createdAt || now;
    const nextName = normalizeThreadName(payload.name) || THREAD_DEFAULT_NAME;

    await prisma.$transaction(async (transaction) => {
      await transaction.thread.create({
        data: {
          id: payload.id,
          userId,
          name: nextName,
          createdAt,
          updatedAt: now,
          deletedAt: null,
          reasoningEffort: payload.reasoningEffort,
          webSearchEnabled: payload.webSearchEnabled,
          threadEnvironmentJson: JSON.stringify(payload.threadEnvironment),
          instructionContextTogglesJson: JSON.stringify(
            payload.instructionContextToggles,
          ),
        },
      });

      await transaction.threadInstruction.create({
        data: {
          threadId: payload.id,
          content: payload.instruction.content,
        },
      });
    });

    existing = {
      id: payload.id,
      name: nextName,
      deletedAt: null,
    };
  }

  if (existing.deletedAt !== null) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  const nextName = normalizeThreadName(payload.name) || existing.name;

  await prisma.$transaction(async (transaction) => {
    await transaction.thread.update({
      where: {
        id: existing.id,
      },
      data: {
        name: nextName,
        updatedAt,
        reasoningEffort: payload.reasoningEffort,
        webSearchEnabled: payload.webSearchEnabled,
        threadEnvironmentJson: JSON.stringify(payload.threadEnvironment),
        instructionContextTogglesJson: JSON.stringify(
          payload.instructionContextToggles,
        ),
      },
    });

    await transaction.threadInstruction.upsert({
      where: {
        threadId: existing.id,
      },
      create: {
        threadId: existing.id,
        content: payload.instruction.content,
      },
      update: {
        content: payload.instruction.content,
      },
    });

    await transaction.threadMessage.deleteMany({
      where: {
        threadId: existing.id,
      },
    });

    if (payload.messages.length > 0) {
      await transaction.threadMessage.createMany({
        data: payload.messages.map((message, index) => ({
          id: message.id,
          threadId: existing.id,
          conversationOrder: index,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
          turnId: message.turnId,
          attachmentsJson: JSON.stringify(message.attachments),
        })),
      });
    }

    await transaction.threadMcpConnection.deleteMany({
      where: {
        threadId: existing.id,
      },
    });

    if (payload.mcpServers.length > 0) {
      await transaction.threadMcpConnection.createMany({
        data: payload.mcpServers.map((server, index) =>
          server.transport === "stdio"
            ? {
                id: buildThreadMcpServerRowId(existing!.id, server.id, index),
                threadId: existing!.id,
                selectionOrder: index,
                name: server.name,
                transport: server.transport,
                url: null,
                headersJson: null,
                useAzureAuth: false,
                azureAuthScope: null,
                timeoutSeconds: null,
                command: server.command,
                argsJson: JSON.stringify(server.args),
                cwd: server.cwd ?? null,
                envJson: JSON.stringify(server.env),
              }
            : {
                id: buildThreadMcpServerRowId(existing!.id, server.id, index),
                threadId: existing!.id,
                selectionOrder: index,
                name: server.name,
                transport: server.transport,
                url: server.url,
                headersJson: JSON.stringify(server.headers),
                useAzureAuth: server.useAzureAuth,
                azureAuthScope: server.azureAuthScope,
                timeoutSeconds: server.timeoutSeconds,
                command: null,
                argsJson: null,
                cwd: null,
                envJson: null,
              },
        ),
      });
    }

    await transaction.threadOperationLog.deleteMany({
      where: {
        threadId: existing.id,
      },
    });

    if (payload.mcpRpcLogs.length > 0) {
      await transaction.threadOperationLog.createMany({
        data: payload.mcpRpcLogs.map((entry, index) => ({
          rowId: buildThreadOperationLogRowId(existing!.id, entry.id, index),
          sourceRpcId: entry.id,
          threadId: existing!.id,
          conversationOrder: index,
          sequence: entry.sequence,
          operationType: entry.operationType,
          serverName: entry.serverName,
          method: entry.method,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
          requestJson: JSON.stringify(entry.request ?? null),
          responseJson: JSON.stringify(entry.response ?? null),
          isError: entry.isError,
          turnId: entry.turnId,
        })),
      });
    }

    const skillProfileIdsByLocation = await upsertThreadSkillProfiles({
      transaction,
      userId,
      skillSelections: [
        ...payload.skillSelections,
        ...payload.messages.flatMap((message) => message.skillActivations),
      ],
    });

    await transaction.threadSkillActivation.deleteMany({
      where: {
        threadId: existing.id,
      },
    });

    if (payload.skillSelections.length > 0) {
      await transaction.threadSkillActivation.createMany({
        data: payload.skillSelections.map((selection, index) => {
          const skillProfileId = skillProfileIdsByLocation.get(selection.location);
          if (!skillProfileId) {
            throw new Error(
              `Skill profile is not available for location: ${selection.location}`,
            );
          }

          return {
            id: buildThreadSkillActivationRowId(existing!.id, index),
            threadId: existing!.id,
            selectionOrder: index,
            skillProfileId,
          };
        }),
      });
    }

    await transaction.threadMessageSkillActivation.deleteMany({
      where: {
        message: {
          threadId: existing.id,
        },
      },
    });

    const messageSkillActivations = payload.messages.flatMap((message) =>
      message.skillActivations.map((selection, index) => {
        const skillProfileId = skillProfileIdsByLocation.get(selection.location);
        if (!skillProfileId) {
          throw new Error(
            `Skill profile is not available for location: ${selection.location}`,
          );
        }

        return {
          id: buildThreadMessageSkillActivationRowId(message.id, index),
          messageId: message.id,
          selectionOrder: index,
          skillProfileId,
        };
      }),
    );

    if (messageSkillActivations.length > 0) {
      await transaction.threadMessageSkillActivation.createMany({
        data: messageSkillActivations,
      });
    }
  });

  const persistedThread = await readThreadById(userId, existing.id);
  if (!persistedThread) {
    return null;
  }

  return {
    thread: persistedThread,
    created,
  };
}

function isThreadIdConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    meta?: {
      target?: unknown;
    };
  };
  if (candidate.code !== "P2002") {
    return false;
  }

  const target = candidate.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("id");
  }
  if (typeof target === "string") {
    return target.includes("id");
  }

  return false;
}

export type LogicalDeleteThreadResult =
  | {
      status: "not_found";
    }
  | {
      status: "empty";
    }
  | {
      status: "ok";
      thread: ThreadResource;
    };

export async function logicalDeleteThread(
  userId: number,
  threadId: string,
): Promise<LogicalDeleteThreadResult> {
  await ensurePersistenceDatabaseReady();

  const existing = await readThreadById(userId, threadId);
  if (!existing) {
    return { status: "not_found" };
  }
  if (existing.messages.length === 0 && existing.skillSelections.length === 0) {
    return { status: "empty" };
  }

  if (existing.deletedAt === null) {
    const now = new Date().toISOString();
    await prisma.thread.update({
      where: {
        id: threadId,
      },
      data: {
        deletedAt: now,
        updatedAt: now,
      },
    });
  }

  const deleted = await readThreadById(userId, threadId);
  if (!deleted) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    thread: deleted,
  };
}

export type LogicalRestoreThreadResult =
  | {
      status: "not_found";
    }
  | {
      status: "ok";
      thread: ThreadResource;
    };

export async function logicalRestoreThread(
  userId: number,
  threadId: string,
): Promise<LogicalRestoreThreadResult> {
  await ensurePersistenceDatabaseReady();

  const existing = await readThreadById(userId, threadId);
  if (!existing) {
    return { status: "not_found" };
  }

  if (existing.deletedAt !== null) {
    const now = new Date().toISOString();
    await prisma.thread.update({
      where: {
        id: threadId,
      },
      data: {
        deletedAt: null,
        updatedAt: now,
      },
    });
  }

  const restored = await readThreadById(userId, threadId);
  if (!restored) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    thread: restored,
  };
}

async function upsertThreadSkillProfiles(options: {
  transaction: Pick<
    typeof prisma,
    "workspaceSkillRegistryProfile" | "workspaceSkillProfile"
  >;
  userId: number;
  skillSelections: ThreadWritePayload["skillSelections"];
}): Promise<Map<string, number>> {
  const uniqueSelections = new Map<
    string,
    {
      name: string;
      location: string;
      source: string;
      registryOption: (typeof SKILL_REGISTRY_OPTIONS)[number] | null;
    }
  >();

  for (const selection of options.skillSelections) {
    const location = selection.location.trim();
    const name = selection.name.trim();
    if (!location || !name || uniqueSelections.has(location)) {
      continue;
    }

    const registryOption = readSkillRegistryOptionFromSkillLocation(location);
    uniqueSelections.set(location, {
      name,
      location,
      source: registryOption ? "app_data" : readSkillSourceFromLocation(location),
      registryOption,
    });
  }

  const registryProfileIdByRegistryId = new Map<string, number>();
  for (const selection of uniqueSelections.values()) {
    if (!selection.registryOption) {
      continue;
    }

    const registryOption = selection.registryOption;
    if (registryProfileIdByRegistryId.has(registryOption.id)) {
      continue;
    }

    const registryProfile =
      await options.transaction.workspaceSkillRegistryProfile.upsert({
        where: {
          userId_registryId: {
            userId: options.userId,
            registryId: registryOption.id,
          },
        },
        create: {
          userId: options.userId,
          registryId: registryOption.id,
          registryLabel: registryOption.label,
          registryDescription: registryOption.description,
          repository: registryOption.repository,
          repositoryUrl: `https://github.com/${registryOption.repository}`,
          sourcePath: registryOption.sourcePath,
          installDirectoryName: registryOption.installDirectoryName,
        },
        update: {
          registryLabel: registryOption.label,
          registryDescription: registryOption.description,
          repository: registryOption.repository,
          repositoryUrl: `https://github.com/${registryOption.repository}`,
          sourcePath: registryOption.sourcePath,
          installDirectoryName: registryOption.installDirectoryName,
        },
        select: {
          id: true,
        },
      });

    registryProfileIdByRegistryId.set(registryOption.id, registryProfile.id);
  }

  const skillProfileIdByLocation = new Map<string, number>();
  for (const selection of uniqueSelections.values()) {
    const registryProfileId = selection.registryOption
      ? (registryProfileIdByRegistryId.get(selection.registryOption.id) ?? null)
      : null;

    const skillProfile = await options.transaction.workspaceSkillProfile.upsert({
      where: {
        userId_location: {
          userId: options.userId,
          location: selection.location,
        },
      },
      create: {
        userId: options.userId,
        registryProfileId,
        name: selection.name,
        location: selection.location,
        source: selection.source,
      },
      update: {
        registryProfileId,
        name: selection.name,
        source: selection.source,
      },
      select: {
        id: true,
        location: true,
      },
    });

    skillProfileIdByLocation.set(skillProfile.location, skillProfile.id);
  }

  return skillProfileIdByLocation;
}

function readSkillRegistryOptionFromSkillLocation(
  location: string,
): (typeof SKILL_REGISTRY_OPTIONS)[number] | null {
  const normalizedSegments = location
    .trim()
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment.length > 0);
  if (normalizedSegments.length === 0) {
    return null;
  }

  for (let index = 0; index < normalizedSegments.length - 1; index += 1) {
    if (normalizedSegments[index] !== "skills") {
      continue;
    }

    const firstCandidate = normalizedSegments[index + 1] ?? "";
    const secondCandidate = normalizedSegments[index + 2] ?? "";
    const candidates = [firstCandidate];
    if (isPositiveIntegerString(firstCandidate)) {
      candidates.push(secondCandidate);
    }

    for (const candidate of candidates) {
      const registry = SKILL_REGISTRY_OPTIONS.find(
        (option) => option.installDirectoryName === candidate,
      );
      if (registry) {
        return registry;
      }
    }
  }

  return null;
}

function readSkillSourceFromLocation(location: string): string {
  const normalizedLocation = location
    .trim()
    .replaceAll("\\", "/")
    .toLowerCase();
  if (!normalizedLocation) {
    return "workspace";
  }
  if (normalizedLocation.includes("/.codex/skills/")) {
    return "codex_home";
  }
  if (normalizedLocation.includes("/skills/")) {
    return "app_data";
  }

  return "workspace";
}

function isPositiveIntegerString(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

export function isThreadRestorePayload(value: unknown): boolean {
  return isRecord(value) && value.archived === false;
}

function normalizeThreadName(value: string): string {
  return value.trim().slice(0, THREAD_NAME_MAX_LENGTH);
}

export function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
