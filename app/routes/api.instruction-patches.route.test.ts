import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  installGlobalServerErrorLoggingMock,
  logServerRouteEventMock,
  runInstructionEnhancementMock,
} = vi.hoisted(() => ({
  installGlobalServerErrorLoggingMock: vi.fn(),
  logServerRouteEventMock: vi.fn(),
  runInstructionEnhancementMock: vi.fn(),
}));

vi.mock(
  "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway",
  () => ({
    installGlobalServerErrorLogging: installGlobalServerErrorLoggingMock,
    logServerRouteEvent: logServerRouteEventMock,
  }),
);

vi.mock(
  "~/lib/server/infrastructure/gateways/instruction-patches/instruction-enhancement-gateway",
  () => ({
    runInstructionEnhancement: runInstructionEnhancementMock,
  }),
);

import { action, loader } from "./api.instruction-patches";

describe("/api/instruction-patches route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runInstructionEnhancementMock.mockResolvedValue({
      fileName: "instruction.md",
      hunks: [
        {
          oldStart: 1,
          newStart: 1,
          lines: [
            { op: "context", text: "line-1" },
            { op: "add", text: "line-2" },
          ],
        },
      ],
    });
    logServerRouteEventMock.mockResolvedValue(undefined);
  });

  it("loader returns 405", () => {
    const response = loader({} as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("action returns 400 for invalid JSON", async () => {
    const response = await action({
      request: new Request("http://localhost/api/instruction-patches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{invalid",
      }),
    } as never);

    expect(response.status).toBe(400);
    expect(logServerRouteEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/instruction-patches",
        eventName: "invalid_json_body",
      }),
    );
  });

  it("action rejects client-side save payloads", async () => {
    const response = await action({
      request: new Request("http://localhost/api/instruction-patches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instruction: "Save me locally",
        }),
      }),
    } as never);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      code: "invalid_instruction_patch_payload",
      error: "Instruction file save/load must be handled on the client side.",
    });
  });

  it("action rejects missing message", async () => {
    const response = await action({
      request: new Request("http://localhost/api/instruction-patches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          azureConfig: {
            tenantId: "tenant-a",
            baseUrl: "https://example.openai.azure.com/openai/v1/",
            deploymentName: "gpt-5.2",
          },
        }),
      }),
    } as never);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      code: "missing_message",
      error: "`message` is required.",
    });
  });

  it("action returns an instruction patch", async () => {
    const response = await action({
      request: new Request("http://localhost/api/instruction-patches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Improve this instruction",
          azureConfig: {
            tenantId: "tenant-a",
            projectName: "project-a",
            baseUrl: "https://example.openai.azure.com/openai/v1/",
            apiVersion: "v1",
            deploymentName: "gpt-5.2",
          },
        }),
      }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: [
        "--- a/instruction.md",
        "+++ b/instruction.md",
        "@@ -1,1 +1,2 @@",
        " line-1",
        "+line-2",
      ].join("\n"),
    });
  });

  it("maps upstream errors", async () => {
    runInstructionEnhancementMock.mockRejectedValueOnce(
      new Error("Resource not found"),
    );

    const response = await action({
      request: new Request("http://localhost/api/instruction-patches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Improve this instruction",
          azureConfig: {
            tenantId: "tenant-a",
            projectName: "project-a",
            baseUrl: "https://example.openai.azure.com/openai/v1/",
            apiVersion: "v1",
            deploymentName: "missing-deployment",
          },
        }),
      }),
    } as never);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      code: "upstream_service_error",
      error:
        "Resource not found Check Azure base URL and deployment name (missing-deployment).",
    });
  });
});
