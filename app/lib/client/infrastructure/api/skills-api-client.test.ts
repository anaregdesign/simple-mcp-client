import { describe, expect, it, vi } from "vitest";
import { SkillsApiClient } from "./skills-api-client";

describe("SkillsApiClient", () => {
  it("loads skills with GET and refresh query", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain("/api/skills?refresh=1");
      return new Response(
        JSON.stringify({
          skills: [
            {
              name: "gh-fix-ci",
              description: "Fix CI",
              location: "/tmp/gh-fix-ci/SKILL.md",
              source: "codex_home",
            },
          ],
          registries: [],
          skillWarnings: ["skill warning"],
          registryWarnings: [],
          warnings: ["skill warning"],
        }),
        { status: 200 },
      );
    });

    const client = new SkillsApiClient();
    const result = await client.loadSkills({
      forceRefresh: true,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result.skills).toHaveLength(1);
    expect(result.skillWarnings).toEqual(["skill warning"]);
  });

  it("updates a registry skill with encoded path", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/skills/registries/openai_curated/skills/finance/gh-fix-ci");
      expect(init?.method).toBe("PUT");

      return new Response(
        JSON.stringify({
          skills: [],
          registries: [],
          skillWarnings: [],
          registryWarnings: [],
          warnings: [],
          message: 'Installed Skill "gh-fix-ci".',
        }),
        { status: 200 },
      );
    });

    const client = new SkillsApiClient();
    const result = await client.updateRegistrySkill({
      action: "install_registry_skill",
      registryId: "openai_curated",
      skillName: "finance/gh-fix-ci",
      fetchImpl,
    });

    expect(result.message).toBe('Installed Skill "gh-fix-ci".');
  });
});
