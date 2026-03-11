import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { buildMcpToolResponse } from "~/lib/server/infrastructure/mcp/mcp-transport";
import {
  buildDatabaseDebugLatestThreadToolDescription,
  buildDatabaseDebugTableToolDescription,
  databaseDebugDefaultReadLimit,
  databaseDebugFilterOperatorValues,
  databaseDebugLatestThreadDefaultRuntimeEventLimit,
  databaseDebugLatestThreadDefaultMcpRpcLimit,
  databaseDebugLatestThreadDefaultMcpServerLimit,
  databaseDebugLatestThreadDefaultMessageLimit,
  databaseDebugLatestThreadDefaultSkillSelectionLimit,
  databaseDebugLatestThreadMaxRuntimeEventLimit,
  databaseDebugLatestThreadMaxMcpRpcLimit,
  databaseDebugLatestThreadMaxMcpServerLimit,
  databaseDebugLatestThreadMaxMessageLimit,
  databaseDebugLatestThreadMaxSkillSelectionLimit,
  databaseDebugMaxReadLimit,
  databaseDebugMaxReadOffset,
  databaseDebugMaxReadFilters,
  ensureDatabaseDebugReady,
  listDatabaseDebugTables,
  normalizeDatabaseDebugLatestThreadReadOptions,
  normalizeDatabaseDebugReadOptions,
  readDatabaseDebugLatestThreadSnapshot,
  readDatabaseDebugTableRows,
} from "~/lib/server/infrastructure/persistence/mcp-debug-database";

const tableReadInputSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(databaseDebugMaxReadLimit)
    .optional()
    .describe(
      `Maximum rows to return. Defaults to ${databaseDebugDefaultReadLimit} (max ${databaseDebugMaxReadLimit}).`,
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .max(databaseDebugMaxReadOffset)
    .optional()
    .describe(
      `Pagination offset. Defaults to 0 (max ${databaseDebugMaxReadOffset}).`,
    ),
  filterMode: z
    .enum(["all", "any"])
    .optional()
    .describe("How to combine filters: `all` (AND) or `any` (OR). Defaults to `all`."),
  filters: z
    .array(
      z.object({
        field: z
          .string()
          .min(1)
          .describe("Target field name. Must match one of the table fields."),
        operator: z
          .enum(databaseDebugFilterOperatorValues)
          .describe("Comparison operator."),
        value: z
          .union([
            z.string(),
            z.number(),
            z.boolean(),
            z.null(),
            z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
          ])
          .optional()
          .describe("Filter value (or array for `in`)."),
      }),
    )
    .max(databaseDebugMaxReadFilters)
    .optional()
    .describe(
      `Optional row filters (up to ${databaseDebugMaxReadFilters}). Unsupported/invalid entries are ignored.`,
    ),
};

const latestThreadReadInputSchema = {
  threadId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Specific thread ID to read. When omitted, the latest thread by updatedAt is selected.",
    ),
  includeArchived: z
    .boolean()
    .optional()
    .describe("Include archived threads when selecting the latest thread. Defaults to true."),
  includeRuntimeEventLogs: z
    .boolean()
    .optional()
    .describe("Include RuntimeEventLog rows linked to the selected thread. Defaults to true."),
  includeAllRows: z
    .boolean()
    .optional()
    .describe(
      "Return all messages/message skill activations/MCP rows/thread skill selections for the selected thread. Defaults to true.",
    ),
  messageLimit: z
    .number()
    .int()
    .min(1)
    .max(databaseDebugLatestThreadMaxMessageLimit)
    .optional()
    .describe(
      `Applied only when includeAllRows=false. Defaults to ${databaseDebugLatestThreadDefaultMessageLimit} (max ${databaseDebugLatestThreadMaxMessageLimit}).`,
    ),
  mcpServerLimit: z
    .number()
    .int()
    .min(1)
    .max(databaseDebugLatestThreadMaxMcpServerLimit)
    .optional()
    .describe(
      `Applied only when includeAllRows=false. Defaults to ${databaseDebugLatestThreadDefaultMcpServerLimit} (max ${databaseDebugLatestThreadMaxMcpServerLimit}).`,
    ),
  mcpRpcLimit: z
    .number()
    .int()
    .min(1)
    .max(databaseDebugLatestThreadMaxMcpRpcLimit)
    .optional()
    .describe(
      `Applied only when includeAllRows=false. Defaults to ${databaseDebugLatestThreadDefaultMcpRpcLimit} (max ${databaseDebugLatestThreadMaxMcpRpcLimit}).`,
    ),
  skillSelectionLimit: z
    .number()
    .int()
    .min(1)
    .max(databaseDebugLatestThreadMaxSkillSelectionLimit)
    .optional()
    .describe(
      `Applied only when includeAllRows=false. Defaults to ${databaseDebugLatestThreadDefaultSkillSelectionLimit} (max ${databaseDebugLatestThreadMaxSkillSelectionLimit}).`,
    ),
  runtimeEventLimit: z
    .number()
    .int()
    .min(1)
    .max(databaseDebugLatestThreadMaxRuntimeEventLimit)
    .optional()
    .describe(
      `Maximum related RuntimeEventLog rows to return. Defaults to ${databaseDebugLatestThreadDefaultRuntimeEventLimit} (max ${databaseDebugLatestThreadMaxRuntimeEventLimit}).`,
    ),
};

export async function ensureMcpDebugReady(): Promise<void> {
  await ensureDatabaseDebugReady();
}

export function createDatabaseDebugMcpServer(): McpServer {
  const server = new McpServer({
    name: "local-playground-database-debug",
    version: "1.0.0",
  });

  const tables = listDatabaseDebugTables();
  const errorAccumulationTables = tables
    .filter((table) => table.accumulatesErrors)
    .map((table) => table.tableName);

  server.registerTool(
    "debug_describe_database_tables",
    {
      description:
        "Returns the Local Playground Prisma table catalog with role, field definitions, and error-accumulation notes.",
    },
    async () => {
      const payload = {
        schemaSource: "prisma/schema.prisma",
        tables: tables.map((table) => ({
          tableName: table.tableName,
          toolName: table.toolName,
          purpose: table.purpose,
          accumulatesErrors: table.accumulatesErrors,
          fields: table.fields,
        })),
        errorAccumulationTables,
      };

      return buildMcpToolResponse(payload);
    },
  );

  server.registerTool(
    "debug_read_latest_thread_snapshot",
    {
      description: buildDatabaseDebugLatestThreadToolDescription(),
      inputSchema: latestThreadReadInputSchema,
    },
    async (args) => {
      const options = normalizeDatabaseDebugLatestThreadReadOptions(args);
      const result = await readDatabaseDebugLatestThreadSnapshot(options);
      return buildMcpToolResponse(result);
    },
  );

  for (const table of tables) {
    server.registerTool(
      table.toolName,
      {
        description: buildDatabaseDebugTableToolDescription(table),
        inputSchema: tableReadInputSchema,
      },
      async (args) => {
        const options = normalizeDatabaseDebugReadOptions(args, table);
        const result = await readDatabaseDebugTableRows(table, options);
        return buildMcpToolResponse(result);
      },
    );
  }

  return server;
}
