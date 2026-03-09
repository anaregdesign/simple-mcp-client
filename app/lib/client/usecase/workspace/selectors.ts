import {
  readSkillRegistryLabelFromSkillLocation,
  readSkillRegistryOptionById,
  SKILL_REGISTRY_OPTIONS,
} from "~/lib/contracts/skills/registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
  ThreadSkillActivation,
} from "~/lib/contracts/skills/types";

export type ChatCommandSuggestion = {
  id: string;
  label: string;
  description: string;
  detail: string;
  isSelected: boolean;
  isAvailable: boolean;
};

type SelectableSkillOption = {
  name: string;
  description: string;
  location: string;
  source: SkillCatalogEntry["source"] | "app_data";
  badge: string;
  isSelected: boolean;
  isAvailable: boolean;
};

export function buildThreadSkillOptions(options: {
  availableSkills: SkillCatalogEntry[];
  selectedThreadSkills: ThreadSkillActivation[];
}): SelectableSkillOption[] {
  return buildSelectableSkillOptions({
    availableSkills: options.availableSkills,
    selectedSkills: options.selectedThreadSkills,
    unavailableDescription:
      "Saved for this thread, but the SKILL.md file is currently unavailable.",
  });
}

export function buildMessageSkillActivationOptions(options: {
  availableSkills: SkillCatalogEntry[];
  selectedMessageSkillActivations: ThreadSkillActivation[];
}): SelectableSkillOption[] {
  return buildSelectableSkillOptions({
    availableSkills: options.availableSkills,
    selectedSkills: options.selectedMessageSkillActivations,
    unavailableDescription:
      "Added for this message, but the SKILL.md file is currently unavailable.",
  });
}

export function buildSkillRegistryGroups(
  skillRegistryCatalogs: SkillRegistryCatalog[],
) {
  if (skillRegistryCatalogs.length > 0) {
    return skillRegistryCatalogs.map((registry) => ({
      registryUrl:
        readSkillRegistryOptionById(registry.registryId)?.sourceUrl ??
        registry.repositoryUrl,
      registryId: registry.registryId,
      label: registry.registryLabel,
      description: registry.registryDescription,
      skillCount: registry.skills.length,
      installedCount: registry.skills.filter((skill) => skill.isInstalled)
        .length,
      skills: [...registry.skills]
        .sort((left, right) => {
          if (left.isInstalled !== right.isInstalled) {
            return left.isInstalled ? -1 : 1;
          }

          const byTag = (left.tag ?? "").localeCompare(right.tag ?? "");
          if (byTag !== 0) {
            return byTag;
          }

          return left.name.localeCompare(right.name);
        })
        .map((skill) => ({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          detail: skill.isInstalled
            ? `${skill.tag ? `Tag: ${skill.tag} · ` : ""}${
                skill.isUpdateAvailable ? "Update available · " : ""
              }Installed: ${skill.installLocation}`
            : `${skill.tag ? `Tag: ${skill.tag} · ` : ""}Source: ${
                skill.remotePath
              }`,
          isInstalled: skill.isInstalled,
          isUpdateAvailable: skill.isUpdateAvailable,
        })),
    }));
  }

  return SKILL_REGISTRY_OPTIONS.map((registry) => ({
    registryUrl: registry.sourceUrl,
    registryId: registry.id,
    label: registry.label,
    description: registry.description,
    skillCount: 0,
    installedCount: 0,
    skills: [],
  }));
}

export function readSkillCommandSuggestions(
  skillOptions: SelectableSkillOption[],
  queryRaw: string,
): ChatCommandSuggestion[] {
  const query = queryRaw.trim().toLowerCase();
  const maxSuggestions = 12;

  return skillOptions
    .filter((skill) => {
      if (!skill.isAvailable) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.location.toLowerCase().includes(query)
      );
    })
    .slice(0, maxSuggestions)
    .map((skill) => ({
      id: skill.location,
      label: skill.name,
      description: skill.description,
      detail: `${skill.badge} · ${skill.location}`,
      isSelected: skill.isSelected,
      isAvailable: skill.isAvailable,
    }));
}

export function resolveSkillBadgeLabel(
  source: SkillCatalogEntry["source"] | "app_data",
  location: string,
): string {
  if (source === "workspace") {
    return "Workspace";
  }

  if (source === "codex_home") {
    return "CODEX_HOME";
  }

  const registryLabel = readSkillRegistryLabelFromSkillLocation(location);
  return registryLabel ?? "App Data";
}

function buildSelectableSkillOptions(options: {
  availableSkills: SkillCatalogEntry[];
  selectedSkills: ThreadSkillActivation[];
  unavailableDescription: string;
}): SelectableSkillOption[] {
  const availableSkillLocationSet = new Set(
    options.availableSkills.map((skill) => skill.location),
  );
  const selectedSkillLocationSet = new Set(
    options.selectedSkills.map((selection) => selection.location),
  );

  return [
    ...options.availableSkills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      location: skill.location,
      source: skill.source,
      badge: resolveSkillBadgeLabel(skill.source, skill.location),
      isSelected: selectedSkillLocationSet.has(skill.location),
      isAvailable: true,
    })),
    ...options.selectedSkills
      .filter((selection) => !availableSkillLocationSet.has(selection.location))
      .map((selection) => ({
        name: selection.name,
        description: options.unavailableDescription,
        location: selection.location,
        source: "app_data" as const,
        badge: resolveSkillBadgeLabel("app_data", selection.location),
        isSelected: true,
        isAvailable: false,
      })),
  ].sort((left, right) => {
    if (left.isSelected !== right.isSelected) {
      return left.isSelected ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}
