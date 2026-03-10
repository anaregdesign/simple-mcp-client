import { describe, expect, it, vi } from "vitest";
import { ClientApiError } from "~/lib/client/infrastructure/api/api-client";
import type { SkillsCatalogSnapshot } from "~/lib/client/infrastructure/api/skills-api-client";
import type { SkillRegistryId } from "~/lib/contracts/skills/registry";
import {
  handleReloadSkills,
  loadAvailableSkills,
  updateSkillRegistrySkill,
} from "./operations";

function createSkillsCatalogSnapshot(): SkillsCatalogSnapshot {
  return {
    skills: [
      {
        name: "gh-fix-ci",
        description: "Fix CI",
        location: "/tmp/gh-fix-ci/SKILL.md",
        source: "codex_home",
      },
    ],
    skillRegistries: [
      {
        registryId: "openai_curated",
        registryLabel: "OpenAI curated",
        registryDescription: "Curated Skills",
        repository: "openai/skills",
        repositoryUrl: "https://github.com/openai/skills",
        sourcePath: "/tmp/openai-curated",
        skills: [],
      },
    ],
    skillWarnings: ["skill warning"],
    registryWarnings: ["registry warning"],
    warnings: ["skill warning", "registry warning"],
    message: 'Installed Skill "gh-fix-ci".',
    payload: {},
  };
}

function createDependencies(overrides: {
  loadSkills?: (options: {
    forceRefresh?: boolean;
    onAuthRequired?: () => void;
  }) => Promise<SkillsCatalogSnapshot>;
  updateRegistrySkill?: (options: {
    action: "install_registry_skill" | "delete_registry_skill";
    registryId: SkillRegistryId;
    skillName: string;
    onAuthRequired?: () => void;
  }) => Promise<SkillsCatalogSnapshot>;
} = {}) {
  const state = {
    activeWorkspaceUserKey: "tenant::principal",
    skillsRequestSeq: 0,
    lastManualReloadAt: 0,
    availableSkills: [] as SkillsCatalogSnapshot["skills"],
    skillRegistryCatalogs: [] as SkillsCatalogSnapshot["skillRegistries"],
    skillsError: "seed" as string | null,
    skillsWarning: "seed" as string | null,
    skillRegistryError: "seed" as string | null,
    skillRegistryWarning: "seed" as string | null,
    skillRegistrySuccess: "seed" as string | null,
    isLoadingSkills: false,
    isMutatingSkillRegistries: false,
    authRequiredCount: 0,
    backgroundSuccessCount: 0,
    logEvents: [] as string[],
  };

  const deps = {
    readActiveWorkspaceUserKey: () => state.activeWorkspaceUserKey,
    nextSkillsRequestSeq: () => {
      state.skillsRequestSeq += 1;
      return state.skillsRequestSeq;
    },
    readSkillsRequestSeq: () => state.skillsRequestSeq,
    readLastManualReloadAt: () => state.lastManualReloadAt,
    setLastManualReloadAt: (value: number) => {
      state.lastManualReloadAt = value;
    },
    markAzureAuthRequired: () => {
      state.authRequiredCount += 1;
    },
    resolveAzureBackgroundSuccess: () => {
      state.backgroundSuccessCount += 1;
    },
    setAvailableSkills: (value: SkillsCatalogSnapshot["skills"]) => {
      state.availableSkills = value;
    },
    setSkillRegistryCatalogs: (value: SkillsCatalogSnapshot["skillRegistries"]) => {
      state.skillRegistryCatalogs = value;
    },
    setSkillsError: (value: string | null) => {
      state.skillsError = value;
    },
    setSkillsWarning: (value: string | null) => {
      state.skillsWarning = value;
    },
    setSkillRegistryError: (value: string | null) => {
      state.skillRegistryError = value;
    },
    setSkillRegistryWarning: (value: string | null) => {
      state.skillRegistryWarning = value;
    },
    setSkillRegistrySuccess: (value: string | null) => {
      state.skillRegistrySuccess = value;
    },
    setIsLoadingSkills: (value: boolean) => {
      state.isLoadingSkills = value;
    },
    setIsMutatingSkillRegistries: (value: boolean) => {
      state.isMutatingSkillRegistries = value;
    },
    loadSkills:
      overrides.loadSkills ??
      vi.fn(async () => {
        return createSkillsCatalogSnapshot();
      }),
    updateRegistrySkill:
      overrides.updateRegistrySkill ??
      vi.fn(async () => {
        return createSkillsCatalogSnapshot();
      }),
    logClientError: (eventName: string) => {
      state.logEvents.push(eventName);
    },
  };

  return { deps, state };
}

describe("skill-catalog-operations", () => {
  it("loads skills and applies catalog snapshot state", async () => {
    const { deps, state } = createDependencies();

    await loadAvailableSkills(deps);

    expect(state.availableSkills).toEqual(createSkillsCatalogSnapshot().skills);
    expect(state.skillRegistryCatalogs).toEqual(
      createSkillsCatalogSnapshot().skillRegistries,
    );
    expect(state.skillsWarning).toBe("skill warning");
    expect(state.skillRegistryWarning).toBe("registry warning");
    expect(state.skillRegistrySuccess).toBeNull();
    expect(state.backgroundSuccessCount).toBe(1);
    expect(state.isLoadingSkills).toBe(false);
  });

  it("surfaces auth_required errors during registry updates", async () => {
    const { deps, state } = createDependencies({
      updateRegistrySkill: vi.fn(async () => {
        throw new ClientApiError({
          kind: "auth_required",
          message: "Azure login is required.",
          status: 401,
        });
      }),
    });

    await updateSkillRegistrySkill(deps, {
      action: "install_registry_skill",
      registryId: "openai_curated",
      skillName: "finance/gh-fix-ci",
    });

    expect(state.skillRegistryError).toBe("Azure login is required.");
    expect(state.logEvents).toEqual([]);
    expect(state.isMutatingSkillRegistries).toBe(false);
  });

  it("skips manual reloads inside the throttle window", async () => {
    const loadSkills = vi.fn(async () => createSkillsCatalogSnapshot());
    const { deps } = createDependencies({
      loadSkills,
    });
    deps.setLastManualReloadAt(Date.now());

    handleReloadSkills(deps);
    await Promise.resolve();

    expect(loadSkills).not.toHaveBeenCalled();
  });
});
