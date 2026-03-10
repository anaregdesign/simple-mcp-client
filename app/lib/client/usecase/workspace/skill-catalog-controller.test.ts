import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillsCatalogSnapshot } from "~/lib/client/infrastructure/api/skills-api-client";

vi.mock("~/lib/client/usecase/workspace/skill-catalog-operations", () => ({
  applySkillsCatalogSnapshot: vi.fn(),
  handleReloadSkills: vi.fn(),
  loadAvailableSkills: vi.fn(async () => {}),
  updateSkillRegistrySkill: vi.fn(async () => {}),
}));

import {
  applySkillsCatalogSnapshot,
  handleReloadSkills,
  loadAvailableSkills,
  updateSkillRegistrySkill,
} from "~/lib/client/usecase/workspace/skill-catalog-operations";
import {
  createSkillCatalogController,
} from "~/lib/client/usecase/workspace/skill-catalog-controller";

function createSnapshot(): SkillsCatalogSnapshot {
  return {
    skills: [],
    skillRegistries: [],
    skillWarnings: [],
    registryWarnings: [],
    warnings: [],
    message: null,
    payload: {},
  };
}

describe("createSkillCatalogController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assembles skill catalog deps around the current refs", async () => {
    const activeWorkspaceUserKeyRef = { current: "tenant::principal" };
    const skillsRequestSeqRef = { current: 0 };
    const lastManualSkillsReloadAtRef = { current: 0 };

    const controller = createSkillCatalogController({
      activeWorkspaceUserKeyRef,
      skillsRequestSeqRef,
      lastManualSkillsReloadAtRef,
      markAzureAuthRequired: vi.fn(),
      resolveAzureBackgroundSuccess: vi.fn(),
      setAvailableSkills: vi.fn(),
      setSkillRegistryCatalogs: vi.fn(),
      setSkillsError: vi.fn(),
      setSkillsWarning: vi.fn(),
      setSkillRegistryError: vi.fn(),
      setSkillRegistryWarning: vi.fn(),
      setSkillRegistrySuccess: vi.fn(),
      setIsLoadingSkills: vi.fn(),
      setIsMutatingSkillRegistries: vi.fn(),
      loadSkills: vi.fn(async () => createSnapshot()),
      updateRegistrySkill: vi.fn(async () => createSnapshot()),
      logClientError: vi.fn(),
    });

    await controller.loadAvailableSkills({ forceRefresh: true });
    expect(loadAvailableSkills).toHaveBeenCalledTimes(1);
    const loadDeps = vi.mocked(loadAvailableSkills).mock.calls[0]?.[0];
    expect(loadDeps?.readActiveWorkspaceUserKey()).toBe("tenant::principal");
    expect(loadDeps?.nextSkillsRequestSeq()).toBe(1);
    expect(loadDeps?.readSkillsRequestSeq()).toBe(1);
    expect(skillsRequestSeqRef.current).toBe(1);

    controller.applySkillsCatalogSnapshot(createSnapshot());
    expect(applySkillsCatalogSnapshot).toHaveBeenCalledTimes(1);

    await controller.updateSkillRegistrySkill({
      action: "install_registry_skill",
      registryId: "openai_curated",
      skillName: "gh-fix-ci",
    });
    expect(updateSkillRegistrySkill).toHaveBeenCalledTimes(1);

    controller.handleReloadSkills();
    expect(handleReloadSkills).toHaveBeenCalledTimes(1);
    const reloadDeps = vi.mocked(handleReloadSkills).mock.calls[0]?.[0];
    reloadDeps?.setLastManualReloadAt(123);
    expect(lastManualSkillsReloadAtRef.current).toBe(123);
    expect(reloadDeps?.readLastManualReloadAt()).toBe(123);
  });
});
