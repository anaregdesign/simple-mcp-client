import { describe, expect, it, vi } from "vitest";
import { AzureSessionApiClient } from "./azure-session-api-client";

describe("AzureSessionApiClient", () => {
  it("starts an Azure session with tenant payload", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/azure/session");
      expect(init?.method).toBe("PUT");
      expect(init?.body).toBe(JSON.stringify({ tenantId: "tenant-a" }));

      return new Response(
        JSON.stringify({
          message: "Azure login completed.",
        }),
        { status: 200 },
      );
    });

    const client = new AzureSessionApiClient();
    const result = await client.startSession("tenant-a", { fetchImpl });

    expect(result.message).toBe("Azure login completed.");
  });

  it("ends an Azure session with DELETE", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/azure/session");
      expect(init?.method).toBe("DELETE");

      return new Response(
        JSON.stringify({
          message: "Azure logout completed.",
        }),
        { status: 200 },
      );
    });

    const client = new AzureSessionApiClient();
    const result = await client.endSession({ fetchImpl });

    expect(result.message).toBe("Azure logout completed.");
  });
});
