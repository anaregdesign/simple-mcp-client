import { describe, expect, it } from "vitest";
import { SKILL_REGISTRY_OPTIONS } from "~/lib/home/skills/registry";
import { parseSkillRegistryMutationPath } from "./workspace-skill-service";

describe("workspace-skill-service", () => {
  it("parses valid registry and skill path", () => {
    const registryId = SKILL_REGISTRY_OPTIONS[0]?.id;
    expect(typeof registryId).toBe("string");
    if (!registryId) {
      return;
    }

    const parsed = parseSkillRegistryMutationPath(registryId, "demo-skill");
    expect(parsed.ok).toBe(true);
  });

  it("rejects invalid registry id", () => {
    expect(parseSkillRegistryMutationPath("unknown-registry", "demo-skill")).toEqual({
      ok: false,
      error: "`registryId` is invalid.",
    });
  });
});
