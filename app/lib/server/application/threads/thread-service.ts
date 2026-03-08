/**
 * Thread application service module.
 */
import { Prisma } from "@prisma/client";
import { DEFAULT_AGENT_INSTRUCTION, HOME_DEFAULT_REASONING_EFFORT, HOME_REASONING_EFFORT_OPTIONS, THREAD_DEFAULT_NAME } from "~/lib/constants/chat";
import { HOME_THREAD_NAME_MAX_LENGTH } from "~/lib/constants/client";
import { readAzureArmUserContext } from "~/lib/server/auth/azure-user";
import {
  ensurePersistenceDatabaseReady,
  prisma,
} from "~/lib/server/persistence/prisma";
import { getOrCreateUserByIdentity } from "~/lib/server/persistence/user";
import { readThreadSnapshotFromUnknown } from "~/lib/contracts/threads/parsers";
import {
  buildThreadMessageSkillActivationRowId,
  buildThreadOperationLogRowId,
  buildThreadMcpServerRowId,
  buildThreadSkillActivationRowId,
} from "~/lib/server/shared/thread-row-ids";
import {
  hasThreadInteraction,
  hasThreadPersistableState,
} from "~/lib/contracts/threads/snapshot-state";
import { SKILL_REGISTRY_OPTIONS } from "~/lib/contracts/skills/registry";
import type { ThreadSnapshot } from "~/lib/contracts/threads/types";
import { Thread } from "~/lib/domain/threads/thread";

export class ThreadQueryService {
  async readUserThreads(userId: number): Promise<ThreadSnapshot[]> {
    return readUserThreads(userId);
  }
}

export class ThreadApplicationService {
  async createThreadSnapshot(
    userId: number,
    snapshot: ThreadSnapshot,
  ): Promise<CreateThreadSnapshotResult> {
    return createThreadSnapshot(userId, snapshot);
  }

  async updateThreadSnapshot(
    userId: number,
    snapshot: ThreadSnapshot,
  ): Promise<UpdateThreadSnapshotResult> {
    return updateThreadSnapshot(userId, snapshot);
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

async function readUserThreads(userId: number): Promise<ThreadSnapshot[]> {
  await ensurePersistenceDatabaseReady();

  const records = await prisma.thread.findMany({
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
    include: {
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
          skillProfile: {
            include: {
              registryProfile: true,
            },
          },
        },
      },
    },
  });

  const threads: ThreadSnapshot[] = [];
  for (const record of records) {
    const thread = mapStoredThreadToSnapshot(record);
    if (!thread) {
      continue;
    }

    threads.push(thread.toSnapshot());
  }

  return threads;
}

async function readThreadById(userId: number, threadId: string): Promise<Thread | null> {
  await ensurePersistenceDatabaseReady();

  const record = await prisma.thread.findFirst({
    where: {
      id: threadId,
      userId,
    },
    include: {
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
          skillProfile: {
            include: {
              registryProfile: true,
            },
          },
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  return mapStoredThreadToSnapshot(record);
}

type ThreadRecordHead = {
  deletedAt: string | null;
};

export type CreateThreadSnapshotResult =
  | {
      status: "created";
      thread: ThreadSnapshot;
    }
  | {
      status: "conflict";
    }
  | {
      status: "invalid";
    };

async function readThreadRecordHead(userId: number, threadId: string): Promise<ThreadRecordHead | null> {
  await ensurePersistenceDatabaseReady();

  const record = await prisma.thread.findFirst({
    where: {
      id: threadId,
      userId,
    },
    select: {
      deletedAt: true,
    },
  });

  return record;
}

export async function createThreadSnapshot(
  userId: number,
  snapshot: ThreadSnapshot,
): Promise<CreateThreadSnapshotResult> {
  const existing = await readThreadRecordHead(userId, snapshot.id);
  if (existing) {
    return {
      status: "conflict",
    };
  }

  try {
    const saved = await saveThreadSnapshot(userId, snapshot);
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

export type UpdateThreadSnapshotResult =
  | {
      status: "ok";
      thread: ThreadSnapshot;
    }
  | {
      status: "not_found";
    }
  | {
      status: "archived";
    };

export async function updateThreadSnapshot(
  userId: number,
  snapshot: ThreadSnapshot,
): Promise<UpdateThreadSnapshotResult> {
  const existing = await readThreadRecordHead(userId, snapshot.id);
  if (!existing) {
    return { status: "not_found" };
  }
  if (existing.deletedAt !== null) {
    return { status: "archived" };
  }

  const saved = await saveThreadSnapshot(userId, snapshot);
  if (!saved || saved.created) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    thread: saved.thread,
  };
}

export async function saveThreadSnapshot(
  userId: number,
  snapshot: ThreadSnapshot,
): Promise<{ thread: ThreadSnapshot; created: boolean } | null> {
  await ensurePersistenceDatabaseReady();
  let created = false;
  const thread = Thread.fromSnapshot(snapshot);

  let existing = await prisma.thread.findFirst({
    where: {
      id: thread.id,
      userId,
    },
    select: {
      id: true,
      name: true,
      deletedAt: true,
    },
  });

  if (!existing) {
    if (!hasThreadPersistableState(thread.toSnapshot())) {
      return null;
    }
    created = true;

    const now = new Date().toISOString();
    const createdAt = thread.createdAt || now;
    const nextName = normalizeThreadName(thread.name) || THREAD_DEFAULT_NAME;

    await prisma.$transaction(async (transaction) => {
      await transaction.thread.create({
        data: {
          id: thread.id,
          userId,
          name: nextName,
          createdAt,
          updatedAt: now,
          deletedAt: null,
          reasoningEffort: thread.reasoningEffort,
          webSearchEnabled: thread.webSearchEnabled,
          threadEnvironmentJson: JSON.stringify(thread.threadEnvironment),
          instructionContextTogglesJson: JSON.stringify(thread.instructionContextToggles),
        },
      });

      await transaction.threadInstruction.create({
        data: {
          threadId: thread.id,
          content: thread.agentInstruction,
        },
      });
    });

    existing = {
      id: thread.id,
      name: nextName,
      deletedAt: null,
    };
  }

  if (existing.deletedAt !== null) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  const nextName = normalizeThreadName(thread.name) || existing.name;

  await prisma.$transaction(async (transaction) => {
    await transaction.thread.update({
      where: {
        id: existing.id,
      },
      data: {
        name: nextName,
        updatedAt,
        reasoningEffort: thread.reasoningEffort,
        webSearchEnabled: thread.webSearchEnabled,
        threadEnvironmentJson: JSON.stringify(thread.threadEnvironment),
        instructionContextTogglesJson: JSON.stringify(thread.instructionContextToggles),
      },
    });

    await transaction.threadInstruction.upsert({
      where: {
        threadId: existing.id,
      },
      create: {
        threadId: existing.id,
        content: thread.agentInstruction,
      },
      update: {
        content: thread.agentInstruction,
      },
    });

    await transaction.threadMessage.deleteMany({
      where: {
        threadId: existing.id,
      },
    });

    if (thread.messages.length > 0) {
      await transaction.threadMessage.createMany({
        data: thread.messages.map((message, index) => ({
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

    if (thread.mcpServers.length > 0) {
      await transaction.threadMcpConnection.createMany({
        data: thread.mcpServers.map((server, index) =>
          server.transport === "stdio"
            ? {
                id: buildThreadMcpServerRowId(existing.id, server.id, index),
                threadId: existing.id,
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
                id: buildThreadMcpServerRowId(existing.id, server.id, index),
                threadId: existing.id,
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

    if (thread.mcpRpcLogs.length > 0) {
      await transaction.threadOperationLog.createMany({
        data: thread.mcpRpcLogs.map((entry, index) => ({
          rowId: buildThreadOperationLogRowId(existing.id, entry.id, index),
          sourceRpcId: entry.id,
          threadId: existing.id,
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
        ...thread.skillSelections,
        ...thread.messages.flatMap((message) => message.skillActivations),
      ],
    });

    await transaction.threadSkillActivation.deleteMany({
      where: {
        threadId: existing.id,
      },
    });

    if (thread.skillSelections.length > 0) {
      await transaction.threadSkillActivation.createMany({
        data: thread.skillSelections.map((selection, index) => {
          const skillProfileId = skillProfileIdsByLocation.get(selection.location);
          if (!skillProfileId) {
            throw new Error(
              `Skill profile is not available for location: ${selection.location}`,
            );
          }

          return {
            id: buildThreadSkillActivationRowId(existing.id, index),
            threadId: existing.id,
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

    const messageSkillActivations = thread.messages.flatMap((message) =>
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
    thread: persistedThread.toSnapshot(),
    created,
  };
}

function isThreadIdConflictError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
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
      thread: ThreadSnapshot;
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
  if (!hasThreadInteraction(existing)) {
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
    thread: deleted.toSnapshot(),
  };
}

export type LogicalRestoreThreadResult =
  | {
      status: "not_found";
    }
  | {
      status: "ok";
      thread: ThreadSnapshot;
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
    thread: restored.toSnapshot(),
  };
}

async function upsertThreadSkillProfiles(options: {
  transaction: Prisma.TransactionClient;
  userId: number;
  skillSelections: ThreadSnapshot["skillSelections"];
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

    const registryProfile = await options.transaction.workspaceSkillRegistryProfile.upsert({
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
      ? registryProfileIdByRegistryId.get(selection.registryOption.id) ?? null
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
  const normalizedLocation = location.trim().replaceAll("\\", "/").toLowerCase();
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

function mapStoredThreadToSnapshot(value: {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  reasoningEffort: string;
  webSearchEnabled: boolean;
  threadEnvironmentJson: string;
  instructionContextTogglesJson: string;
  instruction: {
    content: string;
  } | null;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
    turnId: string;
    attachmentsJson: string;
    skillActivations: Array<{
      id: string;
      messageId: string;
      selectionOrder: number;
      skillProfileId: number;
      skillProfile: {
        id: number;
        userId: number;
        registryProfileId: number | null;
        name: string;
        location: string;
        source: string;
      };
    }>;
  }>;
  mcpServers: Array<{
    id: string;
    name: string;
    transport: string;
    url: string | null;
    headersJson: string | null;
    useAzureAuth: boolean;
    azureAuthScope: string | null;
    timeoutSeconds: number | null;
    command: string | null;
    argsJson: string | null;
    cwd: string | null;
    envJson: string | null;
  }>;
  mcpRpcLogs: Array<{
    rowId: string;
    sourceRpcId: string;
    sequence: number;
    operationType: string;
    serverName: string;
    method: string;
    startedAt: string;
    completedAt: string;
    requestJson: string;
    responseJson: string;
    isError: boolean;
    turnId: string;
  }>;
  skillSelections: Array<{
    id: string;
    selectionOrder: number;
    skillProfileId: number;
    skillProfile: {
      id: number;
      userId: number;
      registryProfileId: number | null;
      name: string;
      location: string;
      source: string;
      registryProfile: {
        id: number;
        userId: number;
        registryId: string;
        registryLabel: string;
        registryDescription: string;
        repository: string;
        repositoryUrl: string;
        sourcePath: string;
        installDirectoryName: string;
      } | null;
    };
  }>;
}): Thread | null {
  const parsed = readThreadSnapshotFromUnknown(
    {
      id: value.id,
      name: value.name,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
      deletedAt: value.deletedAt,
      reasoningEffort: readThreadReasoningEffort(value.reasoningEffort),
      webSearchEnabled: value.webSearchEnabled === true,
      agentInstruction: value.instruction?.content ?? DEFAULT_AGENT_INSTRUCTION,
      instructionContextToggles: readJsonValue(value.instructionContextTogglesJson, null),
      threadEnvironment: readJsonValue(value.threadEnvironmentJson, {}),
      messages: value.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        turnId: message.turnId,
        attachments: readJsonValue(message.attachmentsJson, []),
        skillActivations: message.skillActivations.map((activation) => ({
          name: activation.skillProfile.name,
          location: activation.skillProfile.location,
        })),
      })),
      mcpServers: value.mcpServers.map((server) =>
        server.transport === "stdio"
          ? {
              id: server.id,
              name: server.name,
              transport: server.transport,
              command: server.command,
              args: readJsonValue(server.argsJson, []),
              cwd: server.cwd ?? undefined,
              env: readJsonValue(server.envJson, {}),
            }
          : {
              id: server.id,
              name: server.name,
              transport: server.transport,
              url: server.url,
              headers: readJsonValue(server.headersJson, {}),
              useAzureAuth: server.useAzureAuth,
              azureAuthScope: server.azureAuthScope,
              timeoutSeconds: server.timeoutSeconds,
            },
      ),
      mcpRpcLogs: value.mcpRpcLogs.map((entry) => ({
        id: entry.sourceRpcId,
        sequence: entry.sequence,
        operationType: entry.operationType,
        serverName: entry.serverName,
        method: entry.method,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        request: readJsonValue(entry.requestJson, null),
        response: readJsonValue(entry.responseJson, null),
        isError: entry.isError,
        turnId: entry.turnId,
      })),
      skillSelections: value.skillSelections.map((selection) => ({
        name: selection.skillProfile.name,
        location: selection.skillProfile.location,
      })),
    },
    {
      fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
    },
  );

  return parsed ? Thread.fromSnapshot(parsed) : null;
}

function readJsonValue<T>(value: string | null, fallback: T): T {
  if (typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function readJsonPayload(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const value = await request.json();
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

export function isThreadRestorePayload(value: unknown): boolean {
  return isRecord(value) && value.archived === false;
}

function normalizeThreadName(value: string): string {
  return value.trim().slice(0, HOME_THREAD_NAME_MAX_LENGTH);
}

function readThreadReasoningEffort(value: string): ThreadSnapshot["reasoningEffort"] {
  if (HOME_REASONING_EFFORT_OPTIONS.includes(value as ThreadSnapshot["reasoningEffort"])) {
    return value as ThreadSnapshot["reasoningEffort"];
  }

  return HOME_DEFAULT_REASONING_EFFORT;
}

export async function readAuthenticatedUser(): Promise<{ id: number } | null> {
  const userContext = await readAzureArmUserContext();
  if (!userContext) {
    return null;
  }

  const user = await getOrCreateUserByIdentity({
    tenantId: userContext.tenantId,
    principalId: userContext.principalId,
  });

  return {
    id: user.id,
  };
}

export function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
