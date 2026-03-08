export const mcpTransportValues = ["streamable_http", "sse", "stdio"] as const;

export type McpTransport = (typeof mcpTransportValues)[number];
