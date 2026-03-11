import { describe, expect, it, vi } from "vitest";
import {
  createWorkspaceMcpProfileOperationDeps,
} from "~/lib/client/usecase/workspace/mcp-profiles/operation-deps";

describe("mcp-profiles/operation-deps", () => {
  it("builds operation deps without changing callbacks", () => {
    const readActiveWorkspaceUserKey = vi.fn(() => "user");
    const deps = createWorkspaceMcpProfileOperationDeps({
      readActiveWorkspaceUserKey,
      nextWorkspaceMcpServerProfileRequestSeq: vi.fn(() => 2),
      readWorkspaceMcpServerProfileRequestSeq: vi.fn(() => 2),
      readWorkspaceMcpServerProfiles: vi.fn(() => []),
      writeWorkspaceMcpServerProfiles: vi.fn(),
      setWorkspaceMcpServerProfileError: vi.fn(),
      setIsLoadingWorkspaceMcpServerProfiles: vi.fn(),
      setEditingMcpServerId: vi.fn(),
      setIsDeletingWorkspaceMcpServerProfile: vi.fn(),
      markAzureAuthRequired: vi.fn(),
      loadProfiles: vi.fn(),
      saveProfile: vi.fn(),
      deleteProfile: vi.fn(),
      logClientError: vi.fn(),
    });

    expect(deps.readActiveWorkspaceUserKey()).toBe("user");
    expect(readActiveWorkspaceUserKey).toHaveBeenCalledTimes(1);
  });
});
