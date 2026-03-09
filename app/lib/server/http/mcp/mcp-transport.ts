import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export function createMcpJsonTransport() {
  return new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
}

export function jsonRpcErrorResponse(
  status: number,
  code: number,
  message: string,
): Response {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: {
        code,
        message,
      },
      id: null,
    },
    { status },
  );
}

export function buildMcpToolResponse<TPayload extends Record<string, unknown>>(
  payload: TPayload,
  options: {
    isError?: boolean;
    text?: string;
  } = {},
) {
  const text =
    typeof options.text === "string"
      ? options.text
      : JSON.stringify(payload, null, 2);
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
    structuredContent: payload,
    ...(options.isError ? { isError: true } : {}),
  };
}
