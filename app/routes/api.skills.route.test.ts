import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readAuthenticatedUserMock,
  discoverWorkspaceSkillsMock,
  createWorkspaceSkillServiceMock,
  createWorkspaceSkillProfilePersistenceRepositoryMock,
  createWorkspaceSkillDiscoveryGatewayMock,
  installGlobalServerErrorLoggingMock,
  logServerRouteEventMock,
} = vi.hoisted(() => ({
  readAuthenticatedUserMock: vi.fn(),
  discoverWorkspaceSkillsMock: vi.fn(),
  createWorkspaceSkillServiceMock: vi.fn(),
  createWorkspaceSkillProfilePersistenceRepositoryMock: vi.fn(() => ({})),
  createWorkspaceSkillDiscoveryGatewayMock: vi.fn(() => ({})),
  installGlobalServerErrorLoggingMock: vi.fn(),
  logServerRouteEventMock: vi.fn(),
}));

vi.mock("~/lib/server/infrastructure/auth/read-authenticated-user", () => ({
  readAuthenticatedUser: readAuthenticatedUserMock,
}));

vi.mock("~/lib/server/usecase/skills/workspace-skill-service", () => ({
  createWorkspaceSkillService: createWorkspaceSkillServiceMock.mockReturnValue({
    discoverWorkspaceSkills: discoverWorkspaceSkillsMock,
  }),
}));

vi.mock(
  "~/lib/server/infrastructure/repositories/workspace-skill-profile-persistence-repository",
  () => ({
    createWorkspaceSkillProfilePersistenceRepository:
      createWorkspaceSkillProfilePersistenceRepositoryMock,
  }),
);

vi.mock(
  "~/lib/server/infrastructure/gateways/skills/skill-discovery-gateway",
  () => ({
    createWorkspaceSkillDiscoveryGateway: createWorkspaceSkillDiscoveryGatewayMock,
  }),
);

vi.mock(
  "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway",
  () => ({
    installGlobalServerErrorLogging: installGlobalServerErrorLoggingMock,
    logServerRouteEvent: logServerRouteEventMock,
  }),
);

import { loader } from "./api.skills";

describe("/api/skills route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readAuthenticatedUserMock.mockResolvedValue({ id: 10 });
    discoverWorkspaceSkillsMock.mockResolvedValue({
      skills: [],
      registries: [],
      skillWarnings: [],
      registryWarnings: [],
      warnings: [],
    });
    logServerRouteEventMock.mockResolvedValue(undefined);
  });

  it("returns 405 for unsupported methods", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/skills", { method: "POST" }),
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });

  it("returns 401 when unauthenticated", async () => {
    readAuthenticatedUserMock.mockResolvedValueOnce(null);

    const response = await loader({
      request: new Request("http://localhost/api/skills", { method: "GET" }),
    } as never);

    expect(response.status).toBe(401);
  });

  it("discovers skills for the authenticated user", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/skills", { method: "GET" }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      skills: [],
      registries: [],
      skillWarnings: [],
      registryWarnings: [],
      warnings: [],
    });
    expect(discoverWorkspaceSkillsMock).toHaveBeenCalledWith({
      userId: 10,
      forceRefresh: false,
    });
  });

  it("logs force refresh requests", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/skills?refresh=true", {
        method: "GET",
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(discoverWorkspaceSkillsMock).toHaveBeenCalledWith({
      userId: 10,
      forceRefresh: true,
    });
    expect(logServerRouteEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/skills",
        eventName: "discover_skills_force_refresh_requested",
        userId: 10,
      }),
    );
  });
});
