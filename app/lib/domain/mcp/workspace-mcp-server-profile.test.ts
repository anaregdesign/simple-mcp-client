import { describe, expect, it } from "vitest";
import { WorkspaceMcpServerProfile } from "~/lib/domain/mcp/workspace-mcp-server-profile";

describe("WorkspaceMcpServerProfile", () => {
  it("builds a stable config key for HTTP profiles", () => {
    const profile = new WorkspaceMcpServerProfile({
      id: "profile-1",
      name: "openai-docs",
      connectOnThreadCreate: true,
      transport: "streamable_http",
      url: "https://developers.openai.com/mcp",
      headers: {
        Authorization: "Bearer demo",
      },
      useAzureAuth: false,
      azureAuthScope: "https://example/.default",
      timeoutSeconds: 30,
    });

    expect(profile.configKey).toContain("streamable_http");
    expect(profile.toSnapshot()).toMatchObject({
      id: "profile-1",
      name: "openai-docs",
      transport: "streamable_http",
    });
  });

  it("throws when stdio command is empty", () => {
    expect(
      () =>
        new WorkspaceMcpServerProfile({
          id: "profile-2",
          name: "filesystem",
          connectOnThreadCreate: false,
          transport: "stdio",
          command: " ",
          args: [],
          env: {},
        }),
    ).toThrow("WorkspaceMcpServerProfile command is required for stdio transport.");
  });
});
