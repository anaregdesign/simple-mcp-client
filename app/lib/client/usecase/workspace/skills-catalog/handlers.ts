import type { SkillRegistryId } from "~/lib/domain/value-objects/skill-registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
  ThreadSkillActivation,
} from "~/lib/contracts/skills/types";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

type SkillSelectionHandlerDependencies = {
  availableSkillByLocation: Map<string, SkillCatalogEntry>;
  skillRegistryCatalogs: SkillRegistryCatalog[];
  readActiveThreadId: () => string;
  updateThreadStateById: (
    threadId: string,
    updater: (current: ThreadState) => ThreadState,
  ) => void;
  setSelectedMessageSkillActivations: (
    updater: (
      current: ThreadSkillActivation[],
    ) => ThreadSkillActivation[],
  ) => void;
  setSkillsError: (message: string | null) => void;
  updateSkillRegistrySkill: (options: {
    action: "install_registry_skill" | "delete_registry_skill";
    registryId: SkillRegistryId;
    skillName: string;
  }) => Promise<void>;
};

export type SkillSelectionHandlers = {
  handleToggleRegistrySkill: (
    registryId: SkillRegistryId,
    skillIdRaw: string,
  ) => void;
  handleAddMessageSkillActivation: (locationRaw: string) => void;
  handleRemoveMessageSkillActivation: (locationRaw: string) => void;
  handleAddThreadSkill: (locationRaw: string) => void;
  handleRemoveThreadSkill: (locationRaw: string) => void;
  handleToggleThreadSkill: (locationRaw: string) => void;
};

export function createSkillSelectionHandlers(
  deps: SkillSelectionHandlerDependencies,
): SkillSelectionHandlers {
  return {
    handleToggleRegistrySkill(registryId, skillIdRaw) {
      const skillId = skillIdRaw.trim();
      if (!skillId) {
        return;
      }

      const registryCatalog = deps.skillRegistryCatalogs.find(
        (registry) => registry.registryId === registryId,
      );
      if (!registryCatalog) {
        return;
      }

      const selectedSkill = registryCatalog.skills.find(
        (skill) => skill.id === skillId,
      );
      if (!selectedSkill) {
        return;
      }

      void deps.updateSkillRegistrySkill({
        action:
          selectedSkill.isInstalled && !selectedSkill.isUpdateAvailable
            ? "delete_registry_skill"
            : "install_registry_skill",
        registryId: registryCatalog.registryId,
        skillName: selectedSkill.id,
      });
    },

    handleAddMessageSkillActivation(locationRaw: string) {
      const location = locationRaw.trim();
      if (!location) {
        return;
      }

      deps.setSelectedMessageSkillActivations((current) => {
        if (current.some((selection) => selection.location === location)) {
          return current;
        }

        const skill = deps.availableSkillByLocation.get(location);
        if (!skill) {
          return current;
        }

        return [
          ...current,
          {
            name: skill.name,
            location: skill.location,
          },
        ];
      });
    },

    handleRemoveMessageSkillActivation(locationRaw: string) {
      const location = locationRaw.trim();
      if (!location) {
        return;
      }

      deps.setSelectedMessageSkillActivations((current) =>
        current.filter((selection) => selection.location !== location),
      );
    },

    handleAddThreadSkill(locationRaw: string) {
      const location = locationRaw.trim();
      if (!location) {
        return;
      }

      const skill = deps.availableSkillByLocation.get(location);
      if (!skill) {
        return;
      }

      const activeId = deps.readActiveThreadId().trim();
      if (!activeId) {
        return;
      }

      deps.updateThreadStateById(activeId, (thread) => {
        if (
          thread.skillSelections.some(
            (selection) => selection.location === location,
          )
        ) {
          return thread;
        }

        return {
          ...thread,
          skillSelections: [
            ...thread.skillSelections,
            {
              name: skill.name,
              location: skill.location,
            },
          ],
        };
      });
      deps.setSkillsError(null);
    },

    handleRemoveThreadSkill(locationRaw: string) {
      const location = locationRaw.trim();
      if (!location) {
        return;
      }

      const activeId = deps.readActiveThreadId().trim();
      if (!activeId) {
        return;
      }

      deps.updateThreadStateById(activeId, (thread) => ({
        ...thread,
        skillSelections: thread.skillSelections.filter(
          (selection) => selection.location !== location,
        ),
      }));
      deps.setSkillsError(null);
    },

    handleToggleThreadSkill(locationRaw: string) {
      const location = locationRaw.trim();
      if (!location) {
        return;
      }

      const activeId = deps.readActiveThreadId().trim();
      if (!activeId) {
        return;
      }

      deps.updateThreadStateById(activeId, (thread) => {
        const existingIndex = thread.skillSelections.findIndex(
          (selection) => selection.location === location,
        );
        if (existingIndex >= 0) {
          return {
            ...thread,
            skillSelections: thread.skillSelections.filter(
              (selection) => selection.location !== location,
            ),
          };
        }

        const skill = deps.availableSkillByLocation.get(location);
        if (!skill) {
          return thread;
        }

        return {
          ...thread,
          skillSelections: [
            ...thread.skillSelections,
            {
              name: skill.name,
              location: skill.location,
            },
          ],
        };
      });
      deps.setSkillsError(null);
    },
  };
}
