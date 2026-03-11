import { describe, expect, it } from "vitest";
import { buildMcpServerConfigKey } from "~/lib/domain/value-objects/mcp-server-config-key";

describe("mcp-server-config-key", () => {
  it("builds stable stdio keys including env and cwd", () => {
    const keyA = buildMcpServerConfigKey({
      transport: "stdio",
      command: "NPX",
      args: ["-y", "@mcp/server"],
      cwd: "/TMP/MCP",
      env: { Z_KEY: "z", A_KEY: "a" },
    });

    const keyB = buildMcpServerConfigKey({
      transport: "stdio",
      command: "npx",
      args: ["-y", "@mcp/server"],
      cwd: "/tmp/mcp",
      env: { A_KEY: "a", Z_KEY: "z" },
    });

    expect(keyA).toBe(keyB);
  });

  it("builds stable HTTP keys with header normalization", () => {
    const keyA = buildMcpServerConfigKey({
      transport: "streamable_http",
      url: "https://EXAMPLE.com/mcp",
      headers: {
        "X-Trace-Id": "trace",
      },
      useAzureAuth: true,
      azureAuthScope: "https://scope/.default",
      timeoutSeconds: 45,
    });

    const keyB = buildMcpServerConfigKey({
      transport: "streamable_http",
      url: "https://example.com/mcp",
      headers: {
        "x-trace-id": "trace",
      },
      useAzureAuth: true,
      azureAuthScope: "HTTPS://SCOPE/.DEFAULT",
      timeoutSeconds: 45,
    });

    expect(keyA).toBe(keyB);
  });
});
