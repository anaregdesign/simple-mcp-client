/**
 * Tests for Client controller API client helpers.
 */
import { describe, expect, it, vi } from "vitest";
import {
  ClientApiError,
  mapApiError,
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/controller/api-client";

describe("resolveAuthRequired", () => {
  it("returns true for status 401 or authRequired payload", () => {
    expect(resolveAuthRequired(401, {})).toBe(true);
    expect(resolveAuthRequired(200, { authRequired: true })).toBe(true);
    expect(resolveAuthRequired(200, { authRequired: false })).toBe(false);
  });

  it("supports custom authRequired predicate", () => {
    expect(
      resolveAuthRequired(200, { requiresLogin: true }, (payload) => {
        return (
          typeof payload === "object" &&
          payload !== null &&
          "requiresLogin" in payload &&
          (payload as { requiresLogin?: boolean }).requiresLogin === true
        );
      }),
    ).toBe(true);
  });
});

describe("mapApiError", () => {
  it("returns Error message or fallback", () => {
    expect(mapApiError(new Error("network down"), "fallback")).toBe("network down");
    expect(mapApiError("unknown", "fallback")).toBe("fallback");
  });
});

describe("requestClientApi", () => {
  it("calls auth-required hook when response status is 401", async () => {
    const onAuthRequired = vi.fn();

    await expect(
      requestClientApi({
        url: "/api/test",
        readPayload: async () => ({ authRequired: false }),
        resolveAuthRequired: (status, payload) => resolveAuthRequired(status, payload),
        readErrorMessage: () => null,
        fallbackErrorMessage: "fallback",
        onAuthRequired,
        fetchImpl: async () => new Response(JSON.stringify({ authRequired: false }), { status: 401 }),
      }),
    ).rejects.toMatchObject({
      kind: "auth_required",
    });

    expect(onAuthRequired).toHaveBeenCalledTimes(1);
  });

  it("calls auth-required hook when payload requires login", async () => {
    const onAuthRequired = vi.fn();

    await expect(
      requestClientApi({
        url: "/api/test",
        readPayload: async () => ({ authRequired: true }),
        resolveAuthRequired: (status, payload) => resolveAuthRequired(status, payload),
        readErrorMessage: () => null,
        fallbackErrorMessage: "fallback",
        onAuthRequired,
        fetchImpl: async () => new Response(JSON.stringify({ authRequired: true }), { status: 500 }),
      }),
    ).rejects.toMatchObject({
      kind: "auth_required",
    });

    expect(onAuthRequired).toHaveBeenCalledTimes(1);
  });

  it("maps network errors and unknown payload errors", async () => {
    await expect(
      requestClientApi({
        url: "/api/test",
        readPayload: async () => ({}),
        resolveAuthRequired: () => false,
        readErrorMessage: () => null,
        fallbackErrorMessage: "network fallback",
        fetchImpl: async () => {
          throw new Error("socket closed");
        },
      }),
    ).rejects.toMatchObject({
      kind: "network_error",
      message: "socket closed",
    } satisfies Partial<ClientApiError>);

    await expect(
      requestClientApi({
        url: "/api/test",
        readPayload: async () => ({ value: 1 }),
        resolveAuthRequired: () => false,
        readErrorMessage: () => null,
        fallbackErrorMessage: "unknown payload",
        fetchImpl: async () => new Response("{}", { status: 500 }),
      }),
    ).rejects.toMatchObject({
      kind: "http_error",
      message: "unknown payload",
    } satisfies Partial<ClientApiError>);
  });

  it("uses custom auth-required message", async () => {
    await expect(
      requestClientApi({
        url: "/api/test",
        readPayload: async () => ({ authRequired: true }),
        resolveAuthRequired: (status, payload) => resolveAuthRequired(status, payload),
        readErrorMessage: () => null,
        fallbackErrorMessage: "fallback",
        authRequiredMessage: "Please sign in.",
        fetchImpl: async () => new Response(JSON.stringify({ authRequired: true }), { status: 401 }),
      }),
    ).rejects.toMatchObject({
      kind: "auth_required",
      message: "Please sign in.",
      status: 401,
    } satisfies Partial<ClientApiError>);
  });

  it("prefers payload error messages for http errors", async () => {
    await expect(
      requestClientApi({
        url: "/api/test",
        readPayload: async () => ({ error: "payload error" }),
        resolveAuthRequired: () => false,
        readErrorMessage: (payload) => payload.error,
        fallbackErrorMessage: "fallback",
        fetchImpl: async () => new Response("{}", { status: 500 }),
      }),
    ).rejects.toMatchObject({
      kind: "http_error",
      message: "payload error",
      status: 500,
    } satisfies Partial<ClientApiError>);
  });

  it("returns response and payload for success", async () => {
    const result = await requestClientApi({
      url: "/api/test",
      readPayload: async () => ({ ok: true }),
      resolveAuthRequired: () => false,
      readErrorMessage: () => null,
      fallbackErrorMessage: "fallback",
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    });

    expect(result.payload).toEqual({ ok: true });
    expect(result.response.status).toBe(200);
  });
});
