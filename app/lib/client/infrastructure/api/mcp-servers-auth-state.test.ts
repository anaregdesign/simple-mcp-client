import { describe, expect, it } from "vitest";
import { isMcpServersAuthRequired } from "./mcp-servers-auth-state";

describe("isMcpServersAuthRequired", () => {
  it("returns true for HTTP 401 even without payload", () => {
    expect(isMcpServersAuthRequired(401, null)).toBe(true);
  });

  it("returns true when payload explicitly requires auth", () => {
    expect(isMcpServersAuthRequired(500, { authRequired: true })).toBe(true);
  });

  it("returns false for non-auth failures", () => {
    expect(isMcpServersAuthRequired(500, { authRequired: false })).toBe(false);
    expect(isMcpServersAuthRequired(400, undefined)).toBe(false);
  });
});
