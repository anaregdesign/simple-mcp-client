/**
 * Database debug metadata and read helpers for MCP tools.
 */
import { prisma } from "~/lib/server/persistence/prisma";
import { databaseDebugTableDefinitions } from "./mcp-debug-database-metadata";
import type {
  DatabaseDebugTableDefinition,
  DatabaseDebugTableFieldDefinition,
} from "./mcp-debug-database-types";

export type {
  DatabaseDebugTableDefinition,
  DatabaseDebugTableFieldDefinition,
} from "./mcp-debug-database-types";

export const databaseDebugFilterOperatorValues = [
  "eq",
  "ne",
  "contains",
  "starts_with",
  "ends_with",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "is_null",
  "is_not_null",
] as const;

export type DatabaseDebugFilterOperator =
  (typeof databaseDebugFilterOperatorValues)[number];
export type DatabaseDebugFilterMode = "all" | "any";
export type DatabaseDebugFilterPrimitive = string | number | boolean | null;
export type DatabaseDebugFilter = {
  field: string;
  operator: DatabaseDebugFilterOperator;
  value?: DatabaseDebugFilterPrimitive | DatabaseDebugFilterPrimitive[];
};

export type DatabaseDebugTableReadOptions = {
  limit: number;
  offset: number;
  filterMode: DatabaseDebugFilterMode;
  filters: DatabaseDebugFilter[];
};

export type DatabaseDebugTableReadResult = {
  tableName: string;
  purpose: string;
  accumulatesErrors: boolean;
  fields: DatabaseDebugTableFieldDefinition[];
  filtering: {
    filterMode: DatabaseDebugFilterMode;
    filterCount: number;
    filters: DatabaseDebugFilter[];
  };
  pagination: {
    limit: number;
    offset: number;
    rowCount: number;
    totalRows: number;
    hasMore: boolean;
  };
  rows: Array<Record<string, unknown>>;
};

export type DatabaseDebugLatestThreadReadOptions = {
  threadId: string | null;
  includeArchived: boolean;
  includeRuntimeEventLogs: boolean;
  includeAllRows: boolean;
  messageLimit: number;
  mcpServerLimit: number;
  mcpRpcLimit: number;
  skillSelectionLimit: number;
  runtimeEventLimit: number;
};

export type DatabaseDebugLatestThreadReadResult = {
  target: {
    mode: "latest" | "by_id";
    threadId: string | null;
    includeArchived: boolean;
  };
  found: boolean;
  snapshot: Record<string, unknown> | null;
  runtimeEventLogs: Array<Record<string, unknown>>;
  counts: {
    messages: number;
    messageSkillActivations: number;
    mcpServers: number;
    mcpRpcLogs: number;
    skillSelections: number;
    runtimeEventLogs: number;
  };
  truncation: {
    messages: boolean;
    messageSkillActivations: boolean;
    mcpServers: boolean;
    mcpRpcLogs: boolean;
    skillSelections: boolean;
    runtimeEventLogs: boolean;
  };
};

export const databaseDebugDefaultReadLimit = 50;
export const databaseDebugMaxReadLimit = 200;
export const databaseDebugMaxReadOffset = 100_000;
export const databaseDebugMaxReadFilters = 12;
export const databaseDebugLatestThreadDefaultMessageLimit = 400;
export const databaseDebugLatestThreadDefaultMcpServerLimit = 64;
export const databaseDebugLatestThreadDefaultMcpRpcLimit = 1_500;
export const databaseDebugLatestThreadDefaultSkillSelectionLimit = 128;
export const databaseDebugLatestThreadDefaultRuntimeEventLimit = 400;
export const databaseDebugLatestThreadMaxMessageLimit = 5_000;
export const databaseDebugLatestThreadMaxMcpServerLimit = 512;
export const databaseDebugLatestThreadMaxMcpRpcLimit = 10_000;
export const databaseDebugLatestThreadMaxSkillSelectionLimit = 1_000;
export const databaseDebugLatestThreadMaxRuntimeEventLimit = 5_000;

const databaseDebugMaxReadInValues = 50;
const databaseDebugMaxTextFilterLength = 2_000;

const tableDefinitions: DatabaseDebugTableDefinition[] = databaseDebugTableDefinitions;
const tableDefinitionByToolName = new Map(
  tableDefinitions.map((table) => [table.toolName, table]),
);

export function listDatabaseDebugTables(): readonly DatabaseDebugTableDefinition[] {
  return tableDefinitions;
}

export function readDatabaseDebugTableByToolName(
  toolName: string,
): DatabaseDebugTableDefinition | null {
  return tableDefinitionByToolName.get(toolName) ?? null;
}

export function buildDatabaseDebugTableToolDescription(
  table: DatabaseDebugTableDefinition,
): string {
  const lines = [
    `Debug read tool for Prisma table "${table.tableName}".`,
    `Role: ${table.purpose}`,
    table.accumulatesErrors
      ? "Error accumulation note: This table stores error records and may grow continuously during runtime."
      : "Error accumulation note: This table is not dedicated to error accumulation.",
    "Fields:",
    ...table.fields.map(
      (field) =>
        `- ${field.name} (${field.type}, ${field.nullable ? "nullable" : "required"}): ${field.description}`,
    ),
    "Query options:",
    '- `limit` / `offset` for pagination.',
    '- `filters` for conditional rows (field + operator + value).',
    `- Supported operators: ${databaseDebugFilterOperatorValues.join(", ")}.`,
    "- `filterMode`: `all` (AND) or `any` (OR).",
  ];

  return lines.join("\n");
}

export function buildDatabaseDebugLatestThreadToolDescription(): string {
  const lines = [
    "Debug read tool for retrieving a full thread snapshot in one call.",
    "Role: Reads the most-recent thread (or an explicit threadId) together with instruction, messages, message skill activations, MCP servers, MCP RPC logs, thread skill selections, and related app event logs.",
    "Schema source: prisma/schema.prisma (Thread, ThreadInstruction, ThreadMessage, ThreadMessageSkillActivation, ThreadMcpConnection, ThreadOperationLog, ThreadSkillActivation, WorkspaceSkillProfile, WorkspaceSkillRegistryProfile, RuntimeEventLog).",
    "Input options:",
    "- `threadId` (TEXT, optional): Specific thread ID to read. When omitted, the latest thread is selected by updatedAt.",
    "- `includeArchived` (BOOLEAN, optional): Include archived threads when selecting the latest thread. Defaults to true.",
    "- `includeRuntimeEventLogs` (BOOLEAN, optional): Include thread-linked RuntimeEventLog rows. Defaults to true.",
    "- `includeAllRows` (BOOLEAN, optional): Return all related thread rows (messages/MCP/skills) without per-section take limits. Defaults to true.",
    `- \`messageLimit\` (INTEGER, optional): Applied when includeAllRows=false. Defaults to ${databaseDebugLatestThreadDefaultMessageLimit} (max ${databaseDebugLatestThreadMaxMessageLimit}).`,
    `- \`mcpServerLimit\` (INTEGER, optional): Applied when includeAllRows=false. Defaults to ${databaseDebugLatestThreadDefaultMcpServerLimit} (max ${databaseDebugLatestThreadMaxMcpServerLimit}).`,
    `- \`mcpRpcLimit\` (INTEGER, optional): Applied when includeAllRows=false. Defaults to ${databaseDebugLatestThreadDefaultMcpRpcLimit} (max ${databaseDebugLatestThreadMaxMcpRpcLimit}).`,
    `- \`skillSelectionLimit\` (INTEGER, optional): Applied when includeAllRows=false. Defaults to ${databaseDebugLatestThreadDefaultSkillSelectionLimit} (max ${databaseDebugLatestThreadMaxSkillSelectionLimit}).`,
    `- \`runtimeEventLimit\` (INTEGER, optional): Maximum RuntimeEventLog rows when includeRuntimeEventLogs=true. Defaults to ${databaseDebugLatestThreadDefaultRuntimeEventLimit} (max ${databaseDebugLatestThreadMaxRuntimeEventLimit}).`,
    "Output fields:",
    "- `target`: Which thread-selection mode was used (`latest` or `by_id`), and the effective threadId/includeArchived flags.",
    "- `found`: Whether a matching thread exists.",
    "- `snapshot.thread`: Thread core metadata. Includes parsed `threadEnvironment` and `instructionContextToggles` alongside raw `threadEnvironmentJson` and `instructionContextTogglesJson`.",
    "- `snapshot.instruction`: Per-thread instruction row (or null when absent).",
    "- `snapshot.messages[]`: Ordered thread messages. Includes parsed `attachments` plus linked `skillActivations` and normalized `normalizedSkillActivations`.",
    "- `snapshot.mcpServers[]`: Ordered MCP server snapshot rows. Includes parsed `headers`/`args`/`env` plus raw JSON fields.",
    "- `snapshot.mcpRpcLogs[]`: Ordered MCP RPC rows. Includes parsed `request`/`response` plus raw JSON fields.",
    "- `snapshot.skillSelections[]`: Ordered thread skill activations including linked `skillProfile` and optional `skillProfile.registryProfile`.",
    "- `runtimeEventLogs[]`: Related RuntimeEventLog rows for the thread. Includes parsed `context` plus raw `contextJson`.",
    "- `counts`: Total row counts per section in storage.",
    "- `truncation`: True when returned rows are truncated by limits.",
  ];

  return lines.join("\n");
}

export function normalizeDatabaseDebugLatestThreadReadOptions(
  options: {
    threadId?: unknown;
    includeArchived?: unknown;
    includeRuntimeEventLogs?: unknown;
    includeAllRows?: unknown;
    messageLimit?: unknown;
    mcpServerLimit?: unknown;
    mcpRpcLimit?: unknown;
    skillSelectionLimit?: unknown;
    runtimeEventLimit?: unknown;
  } = {},
): DatabaseDebugLatestThreadReadOptions {
  return {
    threadId: readOptionalTextOption(options.threadId, 256),
    includeArchived: readBooleanOption(options.includeArchived, true),
    includeRuntimeEventLogs: readBooleanOption(options.includeRuntimeEventLogs, true),
    includeAllRows: readBooleanOption(options.includeAllRows, true),
    messageLimit: readBoundedIntegerOption(
      options.messageLimit,
      databaseDebugLatestThreadDefaultMessageLimit,
      1,
      databaseDebugLatestThreadMaxMessageLimit,
    ),
    mcpServerLimit: readBoundedIntegerOption(
      options.mcpServerLimit,
      databaseDebugLatestThreadDefaultMcpServerLimit,
      1,
      databaseDebugLatestThreadMaxMcpServerLimit,
    ),
    mcpRpcLimit: readBoundedIntegerOption(
      options.mcpRpcLimit,
      databaseDebugLatestThreadDefaultMcpRpcLimit,
      1,
      databaseDebugLatestThreadMaxMcpRpcLimit,
    ),
    skillSelectionLimit: readBoundedIntegerOption(
      options.skillSelectionLimit,
      databaseDebugLatestThreadDefaultSkillSelectionLimit,
      1,
      databaseDebugLatestThreadMaxSkillSelectionLimit,
    ),
    runtimeEventLimit: readBoundedIntegerOption(
      options.runtimeEventLimit,
      databaseDebugLatestThreadDefaultRuntimeEventLimit,
      1,
      databaseDebugLatestThreadMaxRuntimeEventLimit,
    ),
  };
}

export async function readDatabaseDebugLatestThreadSnapshot(
  options: DatabaseDebugLatestThreadReadOptions,
): Promise<DatabaseDebugLatestThreadReadResult> {
  const includeAllRows = options.includeAllRows;
  const selectedById = Boolean(options.threadId);
  const thread = selectedById
    ? await prisma.thread.findFirst({
        where: {
          id: options.threadId!,
        },
        include: {
          instruction: true,
          messages: {
            orderBy: { conversationOrder: "asc" },
            ...(includeAllRows ? {} : { take: options.messageLimit }),
            include: {
              skillActivations: {
                orderBy: { selectionOrder: "asc" },
                include: {
                  skillProfile: {
                    include: {
                      registryProfile: true,
                    },
                  },
                },
              },
            },
          },
          mcpServers: {
            orderBy: { selectionOrder: "asc" },
            ...(includeAllRows ? {} : { take: options.mcpServerLimit }),
          },
          mcpRpcLogs: {
            orderBy: { conversationOrder: "asc" },
            ...(includeAllRows ? {} : { take: options.mcpRpcLimit }),
          },
          skillSelections: {
            orderBy: { selectionOrder: "asc" },
            ...(includeAllRows ? {} : { take: options.skillSelectionLimit }),
            include: {
              skillProfile: {
                include: {
                  registryProfile: true,
                },
              },
            },
          },
          _count: {
            select: {
              messages: true,
              mcpServers: true,
              mcpRpcLogs: true,
              skillSelections: true,
            },
          },
        },
      })
    : await prisma.thread.findFirst({
        where: options.includeArchived ? undefined : { deletedAt: null },
        orderBy: [
          { updatedAt: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        include: {
          instruction: true,
          messages: {
            orderBy: { conversationOrder: "asc" },
            ...(includeAllRows ? {} : { take: options.messageLimit }),
            include: {
              skillActivations: {
                orderBy: { selectionOrder: "asc" },
                include: {
                  skillProfile: {
                    include: {
                      registryProfile: true,
                    },
                  },
                },
              },
            },
          },
          mcpServers: {
            orderBy: { selectionOrder: "asc" },
            ...(includeAllRows ? {} : { take: options.mcpServerLimit }),
          },
          mcpRpcLogs: {
            orderBy: { conversationOrder: "asc" },
            ...(includeAllRows ? {} : { take: options.mcpRpcLimit }),
          },
          skillSelections: {
            orderBy: { selectionOrder: "asc" },
            ...(includeAllRows ? {} : { take: options.skillSelectionLimit }),
            include: {
              skillProfile: {
                include: {
                  registryProfile: true,
                },
              },
            },
          },
          _count: {
            select: {
              messages: true,
              mcpServers: true,
              mcpRpcLogs: true,
              skillSelections: true,
            },
          },
        },
      });

  if (!thread) {
    return {
      target: {
        mode: selectedById ? "by_id" : "latest",
        threadId: options.threadId,
        includeArchived: options.includeArchived,
      },
      found: false,
      snapshot: null,
      runtimeEventLogs: [],
      counts: {
        messages: 0,
        messageSkillActivations: 0,
        mcpServers: 0,
        mcpRpcLogs: 0,
        skillSelections: 0,
        runtimeEventLogs: 0,
      },
      truncation: {
        messages: false,
        messageSkillActivations: false,
        mcpServers: false,
        mcpRpcLogs: false,
        skillSelections: false,
        runtimeEventLogs: false,
      },
    };
  }

  const [runtimeEventLogs, runtimeEventLogCount, messageSkillActivationCount] = options.includeRuntimeEventLogs
    ? await Promise.all([
        prisma.runtimeEventLog.findMany({
          where: {
            threadId: thread.id,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: options.runtimeEventLimit,
        }),
        prisma.runtimeEventLog.count({
          where: {
            threadId: thread.id,
          },
        }),
        prisma.threadMessageSkillActivation.count({
          where: {
            message: {
              threadId: thread.id,
            },
          },
        }),
      ])
    : await Promise.all([
        Promise.resolve([]),
        Promise.resolve(0),
        prisma.threadMessageSkillActivation.count({
          where: {
            message: {
              threadId: thread.id,
            },
          },
        }),
      ]);

  const messages = thread.messages.map((message) => ({
    ...message,
    attachments: normalizeUnknownForJson(readJsonValue(message.attachmentsJson, [])),
    skillActivations: message.skillActivations.map((activation) => ({
      ...activation,
      skillProfile: {
        ...activation.skillProfile,
        registryProfile: activation.skillProfile.registryProfile
          ? { ...activation.skillProfile.registryProfile }
          : null,
      },
    })),
    normalizedSkillActivations: message.skillActivations.map((activation) => ({
      name: activation.skillProfile.name,
      location: activation.skillProfile.location,
    })),
  }));
  const messageSkillActivationRows = messages.flatMap((message) => message.skillActivations);
  const mcpServers = thread.mcpServers.map((server) => ({
    ...server,
    headers: normalizeUnknownForJson(readJsonValue(server.headersJson, {})),
    args: normalizeUnknownForJson(readJsonValue(server.argsJson, [])),
    env: normalizeUnknownForJson(readJsonValue(server.envJson, {})),
  }));
  const mcpRpcLogs = thread.mcpRpcLogs.map((entry) => ({
    ...entry,
    request: normalizeUnknownForJson(readJsonValue(entry.requestJson, null)),
    response: normalizeUnknownForJson(readJsonValue(entry.responseJson, null)),
  }));
  const skillSelections = thread.skillSelections.map((selection) => ({
    ...selection,
    skillProfile: {
      ...selection.skillProfile,
      registryProfile: selection.skillProfile.registryProfile
        ? { ...selection.skillProfile.registryProfile }
        : null,
    },
  }));
  const threadRecord = {
    id: thread.id,
    userId: thread.userId,
    name: thread.name,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    deletedAt: thread.deletedAt,
    reasoningEffort: thread.reasoningEffort,
    webSearchEnabled: thread.webSearchEnabled,
    threadEnvironmentJson: thread.threadEnvironmentJson,
    threadEnvironment: normalizeUnknownForJson(readJsonValue(thread.threadEnvironmentJson, {})),
    instructionContextTogglesJson: thread.instructionContextTogglesJson,
    instructionContextToggles: normalizeUnknownForJson(
      readJsonValue(thread.instructionContextTogglesJson, {}),
    ),
  };
  const instruction = thread.instruction ? { ...thread.instruction } : null;
  const normalizedRuntimeEventLogs = runtimeEventLogs.map((event) => ({
    ...event,
    context: normalizeUnknownForJson(readJsonValue(event.contextJson, {})),
  }));

  return {
    target: {
      mode: selectedById ? "by_id" : "latest",
      threadId: thread.id,
      includeArchived: options.includeArchived,
    },
    found: true,
    snapshot: {
      thread: threadRecord,
      instruction,
      messages,
      mcpServers,
      mcpRpcLogs,
      skillSelections,
    },
    runtimeEventLogs: normalizedRuntimeEventLogs.map((row) => normalizeRecordForJson(row)),
    counts: {
      messages: thread._count.messages,
      messageSkillActivations: messageSkillActivationCount,
      mcpServers: thread._count.mcpServers,
      mcpRpcLogs: thread._count.mcpRpcLogs,
      skillSelections: thread._count.skillSelections,
      runtimeEventLogs: runtimeEventLogCount,
    },
    truncation: {
      messages: messages.length < thread._count.messages,
      messageSkillActivations: messageSkillActivationRows.length < messageSkillActivationCount,
      mcpServers: mcpServers.length < thread._count.mcpServers,
      mcpRpcLogs: mcpRpcLogs.length < thread._count.mcpRpcLogs,
      skillSelections: skillSelections.length < thread._count.skillSelections,
      runtimeEventLogs: normalizedRuntimeEventLogs.length < runtimeEventLogCount,
    },
  };
}

export function normalizeDatabaseDebugReadOptions(
  options: {
    limit?: unknown;
    offset?: unknown;
    filterMode?: unknown;
    filters?: unknown;
  } = {},
  table?: DatabaseDebugTableDefinition,
): DatabaseDebugTableReadOptions {
  const parsedLimit = readIntegerOption(options.limit);
  const parsedOffset = readIntegerOption(options.offset);
  const limitCandidate =
    parsedLimit === null ? databaseDebugDefaultReadLimit : parsedLimit;
  const offsetCandidate = parsedOffset === null ? 0 : parsedOffset;

  const limit = Math.min(databaseDebugMaxReadLimit, Math.max(1, limitCandidate));
  const offset = Math.min(databaseDebugMaxReadOffset, Math.max(0, offsetCandidate));

  return {
    limit,
    offset,
    filterMode: readFilterMode(options.filterMode),
    filters: readFilters(options.filters, table),
  };
}

export async function readDatabaseDebugTableRows(
  table: DatabaseDebugTableDefinition,
  options: DatabaseDebugTableReadOptions,
): Promise<DatabaseDebugTableReadResult> {
  const whereClause = buildWhereClause(table, options);
  const totalRows = await readDatabaseDebugTableRowCount(table.tableName, whereClause);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "${table.tableName}"${whereClause.sql} ORDER BY rowid DESC LIMIT ? OFFSET ?`,
    ...whereClause.params,
    options.limit,
    options.offset,
  );

  const normalizedRows = rows.map((row) => normalizeRecordForJson(row));
  const rowCount = normalizedRows.length;
  const hasMore = options.offset + rowCount < totalRows;

  return {
    tableName: table.tableName,
    purpose: table.purpose,
    accumulatesErrors: table.accumulatesErrors,
    fields: table.fields,
    filtering: {
      filterMode: options.filterMode,
      filterCount: options.filters.length,
      filters: options.filters,
    },
    pagination: {
      limit: options.limit,
      offset: options.offset,
      rowCount,
      totalRows,
      hasMore,
    },
    rows: normalizedRows,
  };
}

type SqlClause = {
  sql: string;
  params: unknown[];
};

async function readDatabaseDebugTableRowCount(
  tableName: string,
  whereClause: SqlClause,
): Promise<number> {
  const result = await prisma.$queryRawUnsafe<Array<{ count?: unknown }>>(
    `SELECT COUNT(*) AS count FROM "${tableName}"${whereClause.sql}`,
    ...whereClause.params,
  );
  const countValue = result[0]?.count;
  return readIntegerFromUnknown(countValue);
}

function buildWhereClause(
  table: DatabaseDebugTableDefinition,
  options: DatabaseDebugTableReadOptions,
): SqlClause {
  if (options.filters.length === 0) {
    return { sql: "", params: [] };
  }

  const fieldNameSet = new Set(table.fields.map((field) => field.name));
  const clauses: string[] = [];
  const params: unknown[] = [];
  for (const filter of options.filters) {
    if (!fieldNameSet.has(filter.field)) {
      continue;
    }

    const column = quoteSqlIdentifier(filter.field);
    if (filter.operator === "is_null") {
      clauses.push(`${column} IS NULL`);
      continue;
    }
    if (filter.operator === "is_not_null") {
      clauses.push(`${column} IS NOT NULL`);
      continue;
    }

    if (filter.operator === "in") {
      if (!Array.isArray(filter.value) || filter.value.length === 0) {
        continue;
      }

      const nonNullValues = filter.value.filter(
        (value): value is string | number | boolean => value !== null,
      );
      const includesNull = filter.value.some((value) => value === null);
      const parts: string[] = [];
      if (nonNullValues.length > 0) {
        const placeholders = nonNullValues.map(() => "?").join(", ");
        parts.push(`${column} IN (${placeholders})`);
        for (const value of nonNullValues) {
          params.push(normalizeSqlParameterValue(value));
        }
      }
      if (includesNull) {
        parts.push(`${column} IS NULL`);
      }
      if (parts.length === 1) {
        clauses.push(parts[0]);
      } else if (parts.length > 1) {
        clauses.push(`(${parts.join(" OR ")})`);
      }
      continue;
    }

    if (filter.value === undefined || Array.isArray(filter.value)) {
      continue;
    }

    if (filter.operator === "eq") {
      if (filter.value === null) {
        clauses.push(`${column} IS NULL`);
      } else {
        clauses.push(`${column} = ?`);
        params.push(normalizeSqlParameterValue(filter.value));
      }
      continue;
    }

    if (filter.operator === "ne") {
      if (filter.value === null) {
        clauses.push(`${column} IS NOT NULL`);
      } else {
        clauses.push(`${column} <> ?`);
        params.push(normalizeSqlParameterValue(filter.value));
      }
      continue;
    }

    if (
      filter.operator === "gt" ||
      filter.operator === "gte" ||
      filter.operator === "lt" ||
      filter.operator === "lte"
    ) {
      if (typeof filter.value !== "number") {
        continue;
      }

      const operator =
        filter.operator === "gt"
          ? ">"
          : filter.operator === "gte"
            ? ">="
            : filter.operator === "lt"
              ? "<"
              : "<=";
      clauses.push(`${column} ${operator} ?`);
      params.push(filter.value);
      continue;
    }

    const escapedText = escapeSqlLikePattern(String(filter.value));
    const pattern =
      filter.operator === "contains"
        ? `%${escapedText}%`
        : filter.operator === "starts_with"
          ? `${escapedText}%`
          : `%${escapedText}`;
    clauses.push(`LOWER(CAST(${column} AS TEXT)) LIKE LOWER(?) ESCAPE '\\'`);
    params.push(pattern);
  }

  if (clauses.length === 0) {
    return { sql: "", params: [] };
  }

  return {
    sql: ` WHERE ${clauses.join(options.filterMode === "any" ? " OR " : " AND ")}`,
    params,
  };
}

function readIntegerOption(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : null;
}

function readBoundedIntegerOption(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = readIntegerOption(value);
  const candidate = parsed === null ? fallback : parsed;
  return Math.min(max, Math.max(min, candidate));
}

function readBooleanOption(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readOptionalTextOption(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function readFilterMode(value: unknown): DatabaseDebugFilterMode {
  return value === "any" ? "any" : "all";
}

function readFilters(
  value: unknown,
  table?: DatabaseDebugTableDefinition,
): DatabaseDebugFilter[] {
  if (!table || !Array.isArray(value)) {
    return [];
  }

  const fieldNames = new Set(table.fields.map((field) => field.name));
  const filters: DatabaseDebugFilter[] = [];

  for (const entry of value) {
    if (filters.length >= databaseDebugMaxReadFilters) {
      break;
    }
    if (!isRecord(entry)) {
      continue;
    }

    const field = typeof entry.field === "string" ? entry.field.trim() : "";
    if (!field || !fieldNames.has(field)) {
      continue;
    }

    const operator = readFilterOperator(entry.operator);
    if (!operator) {
      continue;
    }

    const normalized = readFilterValue(operator, entry.value);
    if (!normalized.ok) {
      continue;
    }

    filters.push({
      field,
      operator,
      ...(normalized.value !== undefined ? { value: normalized.value } : {}),
    });
  }

  return filters;
}

function readFilterOperator(value: unknown): DatabaseDebugFilterOperator | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim() as DatabaseDebugFilterOperator;
  return databaseDebugFilterOperatorValues.includes(normalized)
    ? normalized
    : null;
}

function readFilterValue(
  operator: DatabaseDebugFilterOperator,
  value: unknown,
):
  | { ok: true; value?: DatabaseDebugFilterPrimitive | DatabaseDebugFilterPrimitive[] }
  | { ok: false } {
  if (operator === "is_null" || operator === "is_not_null") {
    return { ok: true };
  }

  if (operator === "in") {
    if (!Array.isArray(value)) {
      return { ok: false };
    }

    const values = value
      .map((entry) => readFilterPrimitive(entry))
      .filter((entry): entry is DatabaseDebugFilterPrimitive => entry !== undefined)
      .slice(0, databaseDebugMaxReadInValues);

    return values.length > 0 ? { ok: true, value: values } : { ok: false };
  }

  const primitive = readFilterPrimitive(value);
  if (primitive === undefined) {
    return { ok: false };
  }

  if (operator === "gt" || operator === "gte" || operator === "lt" || operator === "lte") {
    return typeof primitive === "number"
      ? { ok: true, value: primitive }
      : { ok: false };
  }

  if (operator === "contains" || operator === "starts_with" || operator === "ends_with") {
    const textValue = String(primitive);
    return { ok: true, value: textValue.slice(0, databaseDebugMaxTextFilterLength) };
  }

  if (typeof primitive === "string") {
    return { ok: true, value: primitive.slice(0, databaseDebugMaxTextFilterLength) };
  }

  return { ok: true, value: primitive };
}

function readFilterPrimitive(value: unknown): DatabaseDebugFilterPrimitive | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
}

function quoteSqlIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function normalizeSqlParameterValue(value: string | number | boolean): string | number {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return value;
}

function escapeSqlLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readIntegerFromUnknown(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "bigint") {
    if (value < 0n) {
      return 0;
    }

    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? Math.trunc(asNumber) : Number.MAX_SAFE_INTEGER;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }

  return 0;
}

function normalizeRecordForJson(input: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    normalized[key] = normalizeUnknownForJson(value);
  }
  return normalized;
}

function normalizeUnknownForJson(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeUnknownForJson(entry));
  }

  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      normalized[key] = normalizeUnknownForJson(entry);
    }
    return normalized;
  }

  return value;
}

function readJsonValue<T>(value: string | null | undefined, fallback: T): T {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }

  try {
    return JSON.parse(normalized) as T;
  } catch {
    return fallback;
  }
}
