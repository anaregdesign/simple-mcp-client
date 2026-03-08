/**
 * Test module verifying chat request parser behavior.
 */
import { describe, expect, it } from "vitest";
import {
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
} from "~/lib/constants";
import {
  parseChatRequest,
  parseChatRequestPayload,
  type ParsedChatRequest,
} from "~/lib/server/chat/request-parser";

function buildValidPayload(): Record<string, unknown> {
  return {
    message: "Hello",
    history: [],
    attachments: [],
    supportsReasoningEffort: true,
    reasoningEffort: "low",
    webSearchEnabled: false,
    temperature: 0.5,
    agentInstruction: "Be concise",
    instructionContextToggles: {
      system: true,
    },
    threadEnvironment: {
      HELLO: "WORLD",
    },
    skills: [],
    explicitSkillLocations: [],
    azureConfig: {
      tenantId: "tenant-1",
      projectName: "playground",
      baseUrl: "https://example.openai.azure.com/openai/v1",
      apiVersion: "v1",
      deploymentName: "gpt-5.2",
    },
    mcpServers: [],
  };
}

function expectParsed(result: ReturnType<typeof parseChatRequestPayload>): ParsedChatRequest {
  if (!result.ok) {
    throw new Error(`Expected success but got ${result.error.code}: ${result.error.message}`);
  }

  return result.value;
}

describe("parseChatRequest", () => {
  it("returns invalid_json_body for malformed JSON", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{ invalid-json",
    });

    const result = await parseChatRequest(request);
    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_json_body",
        eventName: "invalid_json_body",
        message: "Invalid JSON body.",
        statusCode: 400,
      },
    });
  });
});

describe("parseChatRequestPayload", () => {
  it("parses a valid payload", () => {
    const parsed = expectParsed(
      parseChatRequestPayload(buildValidPayload(), {
        requestUrl: "http://localhost/api/chat",
      }),
    );

    expect(parsed.message).toBe("Hello");
    expect(parsed.threadId).toBeNull();
    expect(parsed.turnId).toBeNull();
    expect(parsed.temperature).toBe(0.5);
    expect(parsed.webSearchEnabled).toBe(false);
    expect(parsed.reasoningEffort).toBe("low");
    expect(parsed.azureConfig.deploymentName).toBe("gpt-5.2");
  });

  it("fails with missing_message when message is empty", () => {
    const result = parseChatRequestPayload({
      ...buildValidPayload(),
      message: "  ",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "missing_message",
        eventName: "missing_message",
        message: "`message` is required.",
        statusCode: 422,
      },
    });
  });

  it("fails with invalid_instruction_context_toggles_payload when toggles are missing", () => {
    const payload = buildValidPayload();
    delete payload.instructionContextToggles;

    const result = parseChatRequestPayload(payload);
    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_instruction_context_toggles_payload",
        eventName: "invalid_instruction_context_toggles_payload",
        message: "`instructionContextToggles` is required.",
        statusCode: 422,
      },
    });
  });

  it("fails with invalid_reasoning_effort_for_web_search for incompatible settings", () => {
    const result = parseChatRequestPayload({
      ...buildValidPayload(),
      reasoningEffort: "minimal",
      webSearchEnabled: true,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_reasoning_effort_for_web_search",
        eventName: "invalid_reasoning_effort_for_web_search",
        message: "`reasoningEffort` value is not compatible with `webSearchEnabled: true`.",
        statusCode: 422,
      },
    });
  });

  it("fails with invalid_reasoning_effort_for_deployment when deployment does not support minimal", () => {
    const result = parseChatRequestPayload({
      ...buildValidPayload(),
      reasoningEffort: "minimal",
      azureConfig: {
        tenantId: "tenant-1",
        baseUrl: "https://example.openai.azure.com/openai/v1",
        deploymentName: "gpt-5.4",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_reasoning_effort_for_deployment",
        eventName: "invalid_reasoning_effort_for_deployment",
        message: "`reasoningEffort` value is not supported by the selected deployment.",
        statusCode: 422,
      },
    });
  });

  it("fails with invalid_temperature_payload when temperature is out of range", () => {
    const result = parseChatRequestPayload({
      ...buildValidPayload(),
      temperature: 3,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_temperature_payload",
        eventName: "invalid_temperature_payload",
        message: "`temperature` must be between 0 and 2, or omitted (None).",
        statusCode: 422,
      },
    });
  });

  it("fails with invalid_azure_api_version for non-v1 apiVersion", () => {
    const result = parseChatRequestPayload({
      ...buildValidPayload(),
      azureConfig: {
        tenantId: "tenant-1",
        baseUrl: "https://example.openai.azure.com/openai/v1",
        apiVersion: "2025-01-01-preview",
        deploymentName: "gpt-5.2",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_azure_api_version",
        eventName: "invalid_azure_api_version",
        message: "Azure OpenAI v1 endpoint requires `apiVersion` to be `v1`.",
        statusCode: 422,
      },
    });
  });

  it("fails with invalid_mcp_servers_payload when mcp server url is invalid", () => {
    const result = parseChatRequestPayload({
      ...buildValidPayload(),
      mcpServers: [
        {
          name: "invalid",
          transport: "streamable_http",
          url: "ftp://example.com/mcp",
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_mcp_servers_payload",
        eventName: "invalid_mcp_servers_payload",
        message: "mcpServers[0].url must start with http://, https://, or /.",
        statusCode: 422,
      },
    });
  });

  it("supports relative mcp server URL when requestUrl is provided", () => {
    const parsed = expectParsed(
      parseChatRequestPayload(
        {
          ...buildValidPayload(),
          mcpServers: [
            {
              name: "local",
              transport: "streamable_http",
              url: "/mcp/debug",
            },
          ],
        },
        {
          requestUrl: "http://localhost:3000/api/chat",
        },
      ),
    );

    expect(parsed.mcpServers).toEqual([
      {
        name: "local",
        transport: "streamable_http",
        url: "http://localhost:3000/mcp/debug",
        headers: {},
        useAzureAuth: false,
        azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
        timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
      },
    ]);
  });
});
