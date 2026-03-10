export type ThreadSkillReference = {
  name: string;
  location: string;
};

export type ThreadSkillProfile = {
  id: number;
  userId: number;
  registryProfileId: number | null;
  name: string;
  location: string;
  source: string;
};

export type ThreadMessageSkillActivation = {
  id: string;
  messageId: string;
  selectionOrder: number;
  skillProfileId: number;
  skillProfile: ThreadSkillProfile;
};

export type ThreadSkillSelection = {
  id: string;
  threadId: string;
  selectionOrder: number;
  skillProfileId: number;
  skillProfile: ThreadSkillProfile;
};

export function cloneThreadSkillReference(
  reference: ThreadSkillReference,
): ThreadSkillReference {
  return {
    ...reference,
  };
}

export function cloneThreadSkillReferences(
  references: ThreadSkillReference[],
): ThreadSkillReference[] {
  return references.map(cloneThreadSkillReference);
}

export function cloneThreadSkillProfile(
  profile: ThreadSkillProfile,
): ThreadSkillProfile {
  return {
    ...profile,
  };
}

export function cloneThreadMessageSkillActivation(
  activation: ThreadMessageSkillActivation,
): ThreadMessageSkillActivation {
  return {
    ...activation,
    skillProfile: cloneThreadSkillProfile(activation.skillProfile),
  };
}

export function cloneThreadMessageSkillActivations(
  activations: ThreadMessageSkillActivation[],
): ThreadMessageSkillActivation[] {
  return activations.map(cloneThreadMessageSkillActivation);
}

export function cloneThreadSkillSelection(
  selection: ThreadSkillSelection,
): ThreadSkillSelection {
  return {
    ...selection,
    skillProfile: cloneThreadSkillProfile(selection.skillProfile),
  };
}

export function cloneThreadSkillSelections(
  selections: ThreadSkillSelection[],
): ThreadSkillSelection[] {
  return selections.map(cloneThreadSkillSelection);
}

export function toThreadSkillReference(
  profile: Pick<ThreadSkillProfile, "name" | "location">,
): ThreadSkillReference {
  return {
    name: profile.name,
    location: profile.location,
  };
}
