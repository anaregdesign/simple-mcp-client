import { describe, expect, it } from "vitest";
import {
  cloneThreadMessageSkillActivation,
  cloneThreadMessageSkillActivations,
  cloneThreadSkillProfile,
  cloneThreadSkillReference,
  cloneThreadSkillReferences,
  cloneThreadSkillSelection,
  cloneThreadSkillSelections,
  toThreadSkillReference,
} from "~/lib/domain/value-objects/thread-skill";

function createSkillProfile() {
  return {
    id: 1,
    userId: 42,
    registryProfileId: null,
    name: "skill-a",
    location: "/tmp/skill-a",
    source: "workspace",
  };
}

describe("thread-skill", () => {
  it("clones skill references", () => {
    const reference = {
      name: "skill-a",
      location: "/tmp/skill-a",
    };

    const cloned = cloneThreadSkillReference(reference);

    expect(cloned).toEqual(reference);
    expect(cloned).not.toBe(reference);
    expect(cloneThreadSkillReferences([reference])[0]).not.toBe(reference);
  });

  it("clones profiles, activations, and selections defensively", () => {
    const profile = createSkillProfile();
    const activation = {
      id: "activation-a",
      messageId: "message-a",
      selectionOrder: 0,
      skillProfileId: 1,
      skillProfile: profile,
    };
    const selection = {
      id: "selection-a",
      threadId: "thread-a",
      selectionOrder: 0,
      skillProfileId: 1,
      skillProfile: profile,
    };

    expect(cloneThreadSkillProfile(profile)).not.toBe(profile);

    const clonedActivation = cloneThreadMessageSkillActivation(activation);
    const clonedSelection = cloneThreadSkillSelection(selection);

    clonedActivation.skillProfile.name = "updated-activation";
    clonedSelection.skillProfile.name = "updated-selection";

    expect(profile.name).toBe("skill-a");
    expect(cloneThreadMessageSkillActivations([activation])[0]).not.toBe(
      activation,
    );
    expect(cloneThreadSkillSelections([selection])[0]).not.toBe(selection);
  });

  it("builds skill references from profiles", () => {
    expect(toThreadSkillReference(createSkillProfile())).toEqual({
      name: "skill-a",
      location: "/tmp/skill-a",
    });
  });
});
