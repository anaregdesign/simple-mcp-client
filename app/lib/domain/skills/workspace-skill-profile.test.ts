import { describe, expect, it } from "vitest";
import { WorkspaceSkillProfile } from "~/lib/domain/skills/workspace-skill-profile";

describe("WorkspaceSkillProfile", () => {
  it("normalizes persisted values", () => {
    const profile = new WorkspaceSkillProfile({
      id: 7,
      registryProfileId: 3,
      name: " gh-fix-ci ",
      location: " /tmp/skills/gh-fix-ci ",
      source: "app_data",
    });

    expect(profile.name).toBe("gh-fix-ci");
    expect(profile.location).toBe("/tmp/skills/gh-fix-ci");
    expect(profile.hasRegistryProfile()).toBe(true);
  });

  it("rejects non-positive ids", () => {
    expect(
      () =>
        new WorkspaceSkillProfile({
          id: 0,
          registryProfileId: null,
          name: "skill",
          location: "/tmp/skill",
          source: "workspace",
        }),
    ).toThrow("WorkspaceSkillProfile id must be a positive integer.");
  });
});
