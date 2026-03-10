import { describe, expect, it } from "vitest";
import {
  presentReconcileWorkspaceSkillProfilesData,
  presentWorkspaceSkillProfilesData,
} from "~/lib/server/infrastructure/skills/workspace-skill-profile-presentation";

describe("workspace-skill-profile-presentation", () => {
  it("maps domain profile data into transport resources", () => {
    const data = presentWorkspaceSkillProfilesData({
      workspaceSkillProfiles: [
        {
          id: 1,
          userId: 10,
          registryProfileId: 2,
          name: "workspace-skill",
          location: "/Users/hiroki/.codex/skills/workspace-skill/SKILL.md",
          source: "codex_home",
        },
      ],
      workspaceSkillRegistryProfiles: [
        {
          id: 2,
          userId: 10,
          registryId: "openai_curated",
          registryLabel: "OpenAI Curated",
          registryDescription: "Curated registry",
          repository: "openai/skills",
          repositoryUrl: "https://github.com/openai/skills",
          sourcePath: "skills",
          installDirectoryName: "openai_curated",
        },
      ],
    });

    expect(data).toEqual({
      workspaceSkillProfiles: [
        {
          id: 1,
          userId: 10,
          registryProfileId: 2,
          name: "workspace-skill",
          location: "/Users/hiroki/.codex/skills/workspace-skill/SKILL.md",
          source: "codex_home",
        },
      ],
      workspaceSkillRegistryProfiles: [
        {
          id: 2,
          userId: 10,
          registryId: "openai_curated",
          registryLabel: "OpenAI Curated",
          registryDescription: "Curated registry",
          repository: "openai/skills",
          repositoryUrl: "https://github.com/openai/skills",
          sourcePath: "skills",
          installDirectoryName: "openai_curated",
        },
      ],
    });
  });

  it("builds the reconcile response data from domain inputs", () => {
    expect(
      presentReconcileWorkspaceSkillProfilesData({
        discovery: {
          skills: [],
          registries: [],
          skillWarnings: ["skill warning"],
          registryWarnings: ["registry warning"],
          warnings: ["skill warning", "registry warning"],
        },
        sync: {
          workspaceSkillProfileCount: 1,
          workspaceSkillRegistryProfileCount: 2,
        },
        profilesData: {
          workspaceSkillProfiles: [],
          workspaceSkillRegistryProfiles: [],
        },
      }),
    ).toEqual({
      message: "Workspace Skill profiles reconciled from installed Skills.",
      skills: [],
      skillRegistries: [],
      skillWarnings: ["skill warning"],
      registryWarnings: ["registry warning"],
      warnings: ["skill warning", "registry warning"],
      workspaceSkillProfileCount: 1,
      workspaceSkillRegistryProfileCount: 2,
      workspaceSkillProfiles: [],
      workspaceSkillRegistryProfiles: [],
    });
  });
});
