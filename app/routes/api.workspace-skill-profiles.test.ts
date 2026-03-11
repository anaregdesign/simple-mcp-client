import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readAuthenticatedUserMock,
  readWorkspaceSkillProfilesMock,
  discoverWorkspaceSkillsMock,
  syncWorkspaceSkillMastersMock,
  createWorkspaceSkillServiceMock,
  readWorkspaceSkillProfileReconcilePayloadMock,
  installGlobalServerErrorLoggingMock,
  logServerRouteEventMock,
} = vi.hoisted(() => ({
  readAuthenticatedUserMock: vi.fn(),
  readWorkspaceSkillProfilesMock: vi.fn(),
  discoverWorkspaceSkillsMock: vi.fn(),
  syncWorkspaceSkillMastersMock: vi.fn(),
  createWorkspaceSkillServiceMock: vi.fn(),
  readWorkspaceSkillProfileReconcilePayloadMock: vi.fn(),
  installGlobalServerErrorLoggingMock: vi.fn(),
  logServerRouteEventMock: vi.fn(),
}));

vi.mock("~/lib/server/infrastructure/auth/read-authenticated-user", () => ({
  readAuthenticatedUser: readAuthenticatedUserMock,
}));

vi.mock("~/lib/server/usecase/skills/workspace-skill-service", () => ({
  createWorkspaceSkillService: createWorkspaceSkillServiceMock.mockReturnValue({
    readWorkspaceSkillProfiles: readWorkspaceSkillProfilesMock,
    discoverWorkspaceSkills: discoverWorkspaceSkillsMock,
    syncWorkspaceSkillMasters: syncWorkspaceSkillMastersMock,
  }),
}));

vi.mock("~/lib/server/infrastructure/skills/workspace-skill-request", () => ({
  readWorkspaceSkillProfileReconcilePayload:
    readWorkspaceSkillProfileReconcilePayloadMock,
}));

vi.mock("~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway", () => ({
  installGlobalServerErrorLogging: installGlobalServerErrorLoggingMock,
  logServerRouteEvent: logServerRouteEventMock,
}));

import { action, loader } from "./api.workspace-skill-profiles";

describe("/api/workspace-skill-profiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createWorkspaceSkillServiceMock.mockClear();
    readAuthenticatedUserMock.mockResolvedValue({ id: 10 });
    readWorkspaceSkillProfilesMock.mockResolvedValue({
      workspaceSkillProfiles: [],
      workspaceSkillRegistryProfiles: [],
    });
    discoverWorkspaceSkillsMock.mockResolvedValue({
      skills: [],
      registries: [],
      skillWarnings: [],
      registryWarnings: [],
      warnings: [],
    });
    syncWorkspaceSkillMastersMock.mockResolvedValue({
      workspaceSkillProfileCount: 0,
      workspaceSkillRegistryProfileCount: 0,
    });
    readWorkspaceSkillProfileReconcilePayloadMock.mockResolvedValue({
      ok: true,
      value: {
        forceRefresh: false,
      },
    });
    logServerRouteEventMock.mockResolvedValue(undefined);
  });

  it("loader returns 405 with Allow for unsupported methods", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/workspace-skill-profiles", { method: "POST" }),
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, PUT");
  });

  it("loader returns 401 when unauthenticated", async () => {
    readAuthenticatedUserMock.mockResolvedValueOnce(null);

    const response = await loader({
      request: new Request("http://localhost/api/workspace-skill-profiles", { method: "GET" }),
    } as never);

    expect(response.status).toBe(401);
  });

  it("loader returns a raw response object", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/workspace-skill-profiles", { method: "GET" }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workspaceSkillProfiles: [],
      workspaceSkillRegistryProfiles: [],
    });
  });

  it("action returns 405 with Allow for unsupported methods", async () => {
    const response = await action({
      request: new Request("http://localhost/api/workspace-skill-profiles", { method: "PATCH" }),
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, PUT");
  });

  it("action returns 422 for invalid payload", async () => {
    readWorkspaceSkillProfileReconcilePayloadMock.mockResolvedValueOnce({
      ok: false,
      error: "`forceRefresh` must be a boolean.",
    });

    const response = await action({
      request: new Request("http://localhost/api/workspace-skill-profiles", { method: "PUT" }),
    } as never);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_reconcile_workspace_skill_profiles_request",
        message: "`forceRefresh` must be a boolean.",
      },
    });
  });

  it("action returns reconcile result as a raw response object", async () => {
    const response = await action({
      request: new Request("http://localhost/api/workspace-skill-profiles", { method: "PUT" }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Workspace Skill profiles reconciled from installed Skills.",
      skills: [],
      skillRegistries: [],
      skillWarnings: [],
      registryWarnings: [],
      warnings: [],
      workspaceSkillProfileCount: 0,
      workspaceSkillRegistryProfileCount: 0,
      workspaceSkillProfiles: [],
      workspaceSkillRegistryProfiles: [],
    });
  });
});
