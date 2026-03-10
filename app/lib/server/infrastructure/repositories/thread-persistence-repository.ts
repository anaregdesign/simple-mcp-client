import { THREAD_DEFAULT_NAME } from "~/lib/domain/value-objects/thread-defaults";
import { THREAD_NAME_MAX_LENGTH } from "~/lib/constants/client";
import { readSkillRegistryOptionFromSkillLocation } from "~/lib/domain/value-objects/skill-registry";
import { Thread } from "~/lib/domain/entities/thread";
import { hasPersistableThreadState } from "~/lib/domain/policies/thread-persistable-state";
import type { ThreadSkillReference } from "~/lib/domain/value-objects/thread-skill";
import type {
  ThreadLifecycleState,
  ThreadRepository,
  ThreadSaveInput,
} from "~/lib/domain/repositories/thread-repository";
import {
  ensurePersistenceDatabaseReady,
  prisma,
} from "~/lib/server/infrastructure/persistence/prisma";
import {
  buildThreadMessageSkillActivationRowId,
  buildThreadMcpServerRowId,
  buildThreadOperationLogRowId,
  buildThreadSkillActivationRowId,
} from "~/lib/server/infrastructure/repositories/thread-row-ids";
import {
  mapThreadRowToThreadSnapshot,
  type PersistedThreadRow,
  threadRowInclude,
} from "~/lib/server/infrastructure/repositories/thread-persistence-mapper";

export class ThreadPersistenceRepository implements ThreadRepository {
  async listByUserId(userId: number): Promise<Thread[]> {
    await ensurePersistenceDatabaseReady();

    const threads = await prisma.thread.findMany({
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
      include: threadRowInclude,
    });

    return threads.map(mapThreadRowToEntity);
  }

  async findByIdForUser(
    userId: number,
    threadId: string,
  ): Promise<Thread | null> {
    await ensurePersistenceDatabaseReady();

    const thread = await prisma.thread.findFirst({
      where: {
        id: threadId,
        userId,
      },
      include: threadRowInclude,
    });

    return thread ? mapThreadRowToEntity(thread) : null;
  }

  async readLifecycleState(
    userId: number,
    threadId: string,
  ): Promise<ThreadLifecycleState | null> {
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

  async save(
    userId: number,
    payload: ThreadSaveInput,
  ): Promise<{ thread: Thread; created: boolean } | null> {
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
      if (!hasPersistableThreadSnapshot(payload)) {
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
            chatAzureConfigJson: payload.chatAzureConfig
              ? JSON.stringify(payload.chatAzureConfig)
              : null,
            agentConversationId: payload.agentConversationId ?? null,
            threadEnvironmentJson: JSON.stringify(payload.threadEnvironment),
            instructionContextTogglesJson: JSON.stringify(
              payload.instructionContextToggles,
            ),
          },
        });

        await transaction.threadInstruction.create({
          data: {
            threadId: payload.id,
            content: payload.instructionContent,
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
          chatAzureConfigJson: payload.chatAzureConfig
            ? JSON.stringify(payload.chatAzureConfig)
            : null,
          ...(payload.agentConversationId !== undefined
            ? {
                agentConversationId: payload.agentConversationId,
              }
            : {}),
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
          content: payload.instructionContent,
        },
        update: {
          content: payload.instructionContent,
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

      if (payload.operationLogs.length > 0) {
        await transaction.threadOperationLog.createMany({
          data: payload.operationLogs.map((entry, index) => ({
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
            const skillProfileId = skillProfileIdsByLocation.get(
              selection.location,
            );
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
          const skillProfileId = skillProfileIdsByLocation.get(
            selection.location,
          );
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

    const persistedThread = await this.findByIdForUser(userId, existing.id);
    if (!persistedThread) {
      return null;
    }

    return {
      thread: persistedThread,
      created,
    };
  }

  async setDeletedAt(
    userId: number,
    threadId: string,
    deletedAt: string | null,
  ): Promise<Thread | null> {
    await ensurePersistenceDatabaseReady();

    const existing = await this.findByIdForUser(userId, threadId);
    if (!existing) {
      return null;
    }

    const updatedAt = new Date().toISOString();
    await prisma.thread.update({
      where: {
        id: threadId,
      },
      data: {
        deletedAt,
        updatedAt,
      },
    });

    return this.findByIdForUser(userId, threadId);
  }
}

export function createThreadPersistenceRepository(): ThreadRepository {
  return new ThreadPersistenceRepository();
}

function mapThreadRowToEntity(record: PersistedThreadRow): Thread {
  return new Thread(mapThreadRowToThreadSnapshot(record));
}

async function upsertThreadSkillProfiles(options: {
  transaction: Pick<
    typeof prisma,
    "workspaceSkillRegistryProfile" | "workspaceSkillProfile"
  >;
  userId: number;
  skillSelections: ThreadSkillReference[];
}): Promise<Map<string, number>> {
  const uniqueSelections = new Map<
    string,
    {
      name: string;
      location: string;
      source: string;
      registryOption: ReturnType<typeof readSkillRegistryOptionFromSkillLocation>;
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
      source: registryOption
        ? "app_data"
        : readSkillSourceFromLocation(location),
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

    const skillProfile = await options.transaction.workspaceSkillProfile.upsert(
      {
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
      },
    );

    skillProfileIdByLocation.set(skillProfile.location, skillProfile.id);
  }

  return skillProfileIdByLocation;
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

function normalizeThreadName(value: string): string {
  return value.trim().slice(0, THREAD_NAME_MAX_LENGTH);
}

function hasPersistableThreadSnapshot(payload: ThreadSaveInput): boolean {
  return hasPersistableThreadState({
    messageCount: payload.messages.length,
    skillSelectionCount: payload.skillSelections.length,
    reasoningEffort: payload.reasoningEffort,
    webSearchEnabled: payload.webSearchEnabled,
    chatAzureConfig: payload.chatAzureConfig,
    instructionContent: payload.instructionContent,
    instructionContextToggles: payload.instructionContextToggles,
    threadEnvironment: payload.threadEnvironment,
  });
}
