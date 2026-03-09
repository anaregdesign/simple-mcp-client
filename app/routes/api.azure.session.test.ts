/**
 * Test module verifying api.azure.session behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  startSession,
  endSession,
  logServerRouteEvent,
} = vi.hoisted(() => ({
  startSession: vi.fn(async () => undefined),
  endSession: vi.fn(),
  logServerRouteEvent: vi.fn(async () => undefined),
}));

vi.mock("~/lib/server/usecase/azure/azure-session-service", () => ({
  azureSessionService: {
    startSession,
    endSession,
  },
}));

vi.mock("~/lib/server/observability/runtime-event-log", () => ({
  installGlobalServerErrorLogging: vi.fn(),
  logServerRouteEvent,
}));

import { action, loader } from "./api.azure.session";

describe("/api/azure/session", () => {
  beforeEach(() => {
    startSession.mockReset();
    startSession.mockResolvedValue(undefined);
    endSession.mockReset();
    logServerRouteEvent.mockReset();
    logServerRouteEvent.mockResolvedValue(undefined);
  });

  it("returns 405 for loader and includes Allow", async () => {
    const response = loader();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("PUT, DELETE");
    expect(await response.json()).toEqual({
      code: "method_not_allowed",
      error: "Method not allowed.",
    });
  });

  it("returns 405 for unsupported methods", async () => {
    const response = await action({
      request: new Request("http://localhost/api/azure/session", { method: "GET" }),
    } as never);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("PUT, DELETE");
  });

  it("starts Azure session on PUT", async () => {
    const response = await action({
      request: new Request("http://localhost/api/azure/session", { method: "PUT" }),
    } as never);
    const payload = (await response.json()) as { message?: string };

    expect(response.status).toBe(200);
    expect(payload.message).toBe("Azure login completed. Azure projects were refreshed.");
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(startSession).toHaveBeenCalledWith("");
  });

  it("passes requested tenantId to the session service", async () => {
    const response = await action({
      request: new Request("http://localhost/api/azure/session", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId: " tenant-b ",
        }),
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(startSession).toHaveBeenCalledWith("tenant-b");
  });

  it("returns 500 when Azure session startup fails", async () => {
    startSession.mockRejectedValueOnce(new Error("manual login cancelled"));

    const response = await action({
      request: new Request("http://localhost/api/azure/session", { method: "PUT" }),
    } as never);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("Failed to run Azure login");
    expect(logServerRouteEvent).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when PUT body is invalid JSON", async () => {
    const response = await action({
      request: new Request("http://localhost/api/azure/session", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{",
      }),
    } as never);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid request body.");
    expect(startSession).not.toHaveBeenCalled();
  });

  it("ends Azure session on DELETE and returns success message", async () => {
    const response = await action({
      request: new Request("http://localhost/api/azure/session", { method: "DELETE" }),
    } as never);
    const payload = (await response.json()) as { message?: string };

    expect(response.status).toBe(200);
    expect(payload.message).toBe("Azure logout completed. Sign in again when needed.");
    expect(endSession).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when Azure logout reset fails", async () => {
    endSession.mockImplementationOnce(() => {
      throw new Error("reset failed");
    });

    const response = await action({
      request: new Request("http://localhost/api/azure/session", { method: "DELETE" }),
    } as never);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("Failed to reset Azure authentication state");
    expect(logServerRouteEvent).toHaveBeenCalledTimes(1);
  });
});
