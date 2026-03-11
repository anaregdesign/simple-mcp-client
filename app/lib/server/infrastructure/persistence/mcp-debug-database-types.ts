/**
 * Shared metadata types for MCP debug database tools.
 */
export type DatabaseDebugTableFieldDefinition = {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
};

export type DatabaseDebugTableDefinition = {
  tableName: string;
  toolName: string;
  purpose: string;
  accumulatesErrors: boolean;
  fields: DatabaseDebugTableFieldDefinition[];
};
