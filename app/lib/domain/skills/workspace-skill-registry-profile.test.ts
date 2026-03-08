import { describe, expect, it } from "vitest";
import { WorkspaceSkillRegistryProfile } from "~/lib/domain/skills/workspace-skill-registry-profile";

describe("WorkspaceSkillRegistryProfile", () => {
  it("builds a persistence record from catalog data", () => {
    const profile = WorkspaceSkillRegistryProfile.fromCatalog(
      {
        registryId: "openai_curated",
        registryLabel: "OpenAI Curated",
        registryDescription: "Official curated Skill registry from openai/skills.",
        repository: "openai/skills",
        repositoryUrl: "https://github.com/openai/skills",
        sourcePath: "skills/.curated",
        skills: [],
      },
      {
        id: "openai_curated",
        label: "OpenAI Curated",
        description: "Official curated Skill registry from openai/skills.",
        repository: "openai/skills",
        ref: "main",
        sourcePath: "skills/.curated",
        sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated",
        installDirectoryName: "openai-curated",
        skillPathLayout: "flat",
      },
    );

    expect(profile.toPersistenceRecord(10)).toMatchObject({
      userId: 10,
      registryId: "openai_curated",
      installDirectoryName: "openai-curated",
    });
  });

  it("rejects missing registry ids", () => {
    expect(
      () =>
        new WorkspaceSkillRegistryProfile({
          registryId: "",
          registryLabel: "Registry",
          registryDescription: "",
          repository: "owner/repo",
          repositoryUrl: "https://github.com/owner/repo",
          sourcePath: "skills",
          installDirectoryName: "registry",
        }),
    ).toThrow("WorkspaceSkillRegistryProfile registryId is required.");
  });
});
