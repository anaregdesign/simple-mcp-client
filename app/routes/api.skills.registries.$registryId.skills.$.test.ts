/**
 * Test module verifying api.skills.registries.$registryId.skills.$ behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  parseSkillRegistryMutationPath,
  readAuthenticatedUser,
  createWorkspaceSkillRegistryMutationService,
  createWorkspaceSkillService,
  installSkill,
  deleteSkill,
  logServerRouteEvent,
} = vi.hoisted(() => ({
  parseSkillRegistryMutationPath: vi.fn(() => ({
    ok: true as const,
    value: {
      registryId: "openai_curated",
      skillName: "gh-fix-ci",
    },
  })),
  readAuthenticatedUser: vi.fn(async () => ({ id: 1 })),
  createWorkspaceSkillRegistryMutationService: vi.fn(),
  createWorkspaceSkillService: vi.fn(),
  installSkill: vi.fn(async () => ({
    operation: "installed" as "installed" | "updated" | "unchanged",
    skillName: "gh-fix-ci",
    discoveryResult: {
      skills: [],
      registries: [],
      skillWarnings: [],
      registryWarnings: [],
      warnings: [],
    },
  })),
  deleteSkill: vi.fn(async () => ({
    operation: "removed" as "removed" | "missing",
    skillName: "gh-fix-ci",
    discoveryResult: {
      skills: [],
      registries: [],
      skillWarnings: [],
      registryWarnings: [],
      warnings: [],
    },
  })),
  logServerRouteEvent: vi.fn(async () => undefined),
}));

vi.mock("~/lib/server/infrastructure/auth/read-authenticated-user", () => ({
  readAuthenticatedUser,
}));

vi.mock("~/lib/server/usecase/skills/workspace-skill-service", () => ({
  createWorkspaceSkillService: createWorkspaceSkillService.mockReturnValue({
    discoverWorkspaceSkills: vi.fn(),
    syncWorkspaceSkillMasters: vi.fn(),
  }),
}));

vi.mock("~/lib/server/infrastructure/skills/workspace-skill-request", () => ({
  parseSkillRegistryMutationPath,
}));

vi.mock("~/lib/server/usecase/skills/workspace-skill-registry-mutation-service", () => ({
  createWorkspaceSkillRegistryMutationService:
    createWorkspaceSkillRegistryMutationService.mockReturnValue({
      installSkill,
      deleteSkill,
    }),
}));

vi.mock("~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway", () => ({
  installGlobalServerErrorLogging: vi.fn(),
  logServerRouteEvent,
}));

import { action, loader } from "./api.skills.registries.$registryId.skills.$";

describe("/api/skills/registries/:registryId/skills/*", () => {
  beforeEach(() => {
    parseSkillRegistryMutationPath.mockReset();
    parseSkillRegistryMutationPath.mockReturnValue({
      ok: true,
      value: {
        registryId: "openai_curated",
        skillName: "gh-fix-ci",
      },
    });
    readAuthenticatedUser.mockReset();
    readAuthenticatedUser.mockResolvedValue({ id: 1 });
    createWorkspaceSkillRegistryMutationService.mockClear();
    createWorkspaceSkillService.mockClear();
    installSkill.mockReset();
    installSkill.mockResolvedValue({
      operation: "installed",
      skillName: "gh-fix-ci",
      discoveryResult: {
        skills: [],
        registries: [],
        skillWarnings: [],
        registryWarnings: [],
        warnings: [],
      },
    });
    deleteSkill.mockReset();
    deleteSkill.mockResolvedValue({
      operation: "removed",
      skillName: "gh-fix-ci",
      discoveryResult: {
        skills: [],
        registries: [],
        skillWarnings: [],
        registryWarnings: [],
        warnings: [],
      },
    });
    logServerRouteEvent.mockReset();
    logServerRouteEvent.mockResolvedValue(undefined);
  });

  it("returns 405 response with Allow header for loader", async () => {
    const response = loader();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("PUT, DELETE");
  });

  it("returns 405 for unsupported methods", async () => {
    const response = await action({
      request: new Request("http://localhost/api/skills/registries/openai_curated/skills/gh-fix-ci", {
        method: "GET",
      }),
      params: {
        registryId: "openai_curated",
        "*": "gh-fix-ci",
      },
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("PUT, DELETE");
  });

  it("returns 201 and Location for new install", async () => {
    const response = await action({
      request: new Request("http://localhost/api/skills/registries/openai_curated/skills/gh-fix-ci", {
        method: "PUT",
      }),
      params: {
        registryId: "openai_curated",
        "*": "gh-fix-ci",
      },
    } as never);

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe(
      "/api/skills/registries/openai_curated/skills/gh-fix-ci",
    );
  });

  it("returns 200 without Location when installed skill is updated", async () => {
    installSkill.mockResolvedValueOnce({
      operation: "updated",
      skillName: "gh-fix-ci",
      discoveryResult: {
        skills: [],
        registries: [],
        skillWarnings: [],
        registryWarnings: [],
        warnings: [],
      },
    });

    const response = await action({
      request: new Request("http://localhost/api/skills/registries/openai_curated/skills/gh-fix-ci", {
        method: "PUT",
      }),
      params: {
        registryId: "openai_curated",
        "*": "gh-fix-ci",
      },
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(payload.message).toBe('Updated Skill "gh-fix-ci".');
  });

  it("returns 200 when installed skill is already up-to-date", async () => {
    installSkill.mockResolvedValueOnce({
      operation: "unchanged",
      skillName: "gh-fix-ci",
      discoveryResult: {
        skills: [],
        registries: [],
        skillWarnings: [],
        registryWarnings: [],
        warnings: [],
      },
    });

    const response = await action({
      request: new Request("http://localhost/api/skills/registries/openai_curated/skills/gh-fix-ci", {
        method: "PUT",
      }),
      params: {
        registryId: "openai_curated",
        "*": "gh-fix-ci",
      },
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toBe('Skill "gh-fix-ci" is already up-to-date.');
  });

  it("returns 200 when removing an installed skill", async () => {
    const response = await action({
      request: new Request("http://localhost/api/skills/registries/openai_curated/skills/gh-fix-ci", {
        method: "DELETE",
      }),
      params: {
        registryId: "openai_curated",
        "*": "gh-fix-ci",
      },
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(payload.message).toBe('Removed Skill "gh-fix-ci".');
  });
});
