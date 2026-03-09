import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createThreadTitleGenerationGatewayMock,
  createThreadTitleSuggestionServiceMock,
  generateTitleMock,
  installGlobalServerErrorLoggingMock,
  logServerRouteEventMock,
} = vi.hoisted(() => ({
  createThreadTitleGenerationGatewayMock: vi.fn(() => ({})),
  createThreadTitleSuggestionServiceMock: vi.fn(),
  generateTitleMock: vi.fn(),
  installGlobalServerErrorLoggingMock: vi.fn(),
  logServerRouteEventMock: vi.fn(),
}));

vi.mock(
  "~/lib/server/infrastructure/gateways/chat/thread-title-generation-gateway",
  () => ({
    createThreadTitleGenerationGateway: createThreadTitleGenerationGatewayMock,
  }),
);

vi.mock("~/lib/server/usecase/threads/thread-title-suggestion-service", async () => {
  const actual = await vi.importActual<
    typeof import("~/lib/server/usecase/threads/thread-title-suggestion-service")
  >("~/lib/server/usecase/threads/thread-title-suggestion-service");

  return {
    ...actual,
    createThreadTitleSuggestionService:
      createThreadTitleSuggestionServiceMock.mockReturnValue({
        generateTitle: generateTitleMock,
      }),
  };
});

vi.mock(
  "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway",
  () => ({
    installGlobalServerErrorLogging: installGlobalServerErrorLoggingMock,
    logServerRouteEvent: logServerRouteEventMock,
  }),
);

import { action, loader } from "./api.threads.title-suggestions";

describe("/api/threads/title-suggestions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateTitleMock.mockResolvedValue("New thread title");
    logServerRouteEventMock.mockResolvedValue(undefined);
  });

  it("loader returns 405", async () => {
    const response = loader({} as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("action returns 400 for invalid JSON", async () => {
    const response = await action({
      request: new Request("http://localhost/api/threads/title-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{invalid-json",
      }),
    } as never);

    expect(response.status).toBe(400);
    expect(logServerRouteEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/threads/title-suggestions",
        eventName: "invalid_json_body",
      }),
    );
  });

  it("action returns 422 for invalid payload", async () => {
    const response = await action({
      request: new Request("http://localhost/api/threads/title-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playgroundContent: "Summarize this",
        }),
      }),
    } as never);

    expect(response.status).toBe(422);
  });

  it("action returns generated title", async () => {
    const response = await action({
      request: new Request("http://localhost/api/threads/title-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playgroundContent: "Summarize this",
          azureConfig: {
            tenantId: "tenant-a",
            projectName: "project-a",
            baseUrl: "https://example.openai.azure.com/openai/v1/",
            apiVersion: "v1",
            deploymentName: "gpt-4.1",
          },
        }),
      }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      title: "New thread title",
    });
  });

  it("maps upstream errors", async () => {
    generateTitleMock.mockRejectedValueOnce(new Error("Resource not found"));

    const response = await action({
      request: new Request("http://localhost/api/threads/title-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playgroundContent: "Summarize this",
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
