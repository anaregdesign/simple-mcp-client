import type { SkillsCatalogSnapshot } from "~/lib/client/infrastructure/api/skills-api-client";
import {
  applySkillsCatalogSnapshot as applySkillsCatalogSnapshotOperation,
  handleReloadSkills as handleReloadSkillsOperation,
  loadAvailableSkills as loadAvailableSkillsOperation,
  updateSkillRegistrySkill as updateSkillRegistrySkillOperation,
} from "~/lib/client/usecase/workspace/skills-catalog/operations";
import type { SkillRegistryId } from "~/lib/domain/value-objects/skill-registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
} from "~/lib/contracts/skills/types";

type SkillCatalogLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type CreateSkillCatalogControllerOptions = {
  readActiveWorkspaceUserKey: () => string;
  nextSkillsRequestSeq: () => number;
  readSkillsRequestSeq: () => number;
  readLastManualReloadAt: () => number;
  setLastManualReloadAt: (value: number) => void;
  markAzureAuthRequired: () => void;
  resolveAzureBackgroundSuccess: () => void;
  setAvailableSkills: (value: SkillCatalogEntry[]) => void;
  setSkillRegistryCatalogs: (value: SkillRegistryCatalog[]) => void;
  setSkillsError: (value: string | null) => void;
  setSkillsWarning: (value: string | null) => void;
  setSkillRegistryError: (value: string | null) => void;
  setSkillRegistryWarning: (value: string | null) => void;
  setSkillRegistrySuccess: (value: string | null) => void;
  setIsLoadingSkills: (value: boolean) => void;
  setIsMutatingSkillRegistries: (value: boolean) => void;
  loadSkills: (options: {
    forceRefresh?: boolean;
    onAuthRequired?: () => void;
  }) => Promise<SkillsCatalogSnapshot>;
  updateRegistrySkill: (options: {
    action: "install_registry_skill" | "delete_registry_skill";
    registryId: SkillRegistryId;
    skillName: string;
    onAuthRequired?: () => void;
  }) => Promise<SkillsCatalogSnapshot>;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: SkillCatalogLogOptions,
  ) => void;
};

export function createSkillCatalogController(
  options: CreateSkillCatalogControllerOptions,
) {
  function buildOperationDeps() {
    return {
      readActiveWorkspaceUserKey: options.readActiveWorkspaceUserKey,
      nextSkillsRequestSeq: options.nextSkillsRequestSeq,
      readSkillsRequestSeq: options.readSkillsRequestSeq,
      readLastManualReloadAt: options.readLastManualReloadAt,
      setLastManualReloadAt: options.setLastManualReloadAt,
      markAzureAuthRequired: options.markAzureAuthRequired,
      resolveAzureBackgroundSuccess: options.resolveAzureBackgroundSuccess,
      setAvailableSkills: options.setAvailableSkills,
      setSkillRegistryCatalogs: options.setSkillRegistryCatalogs,
      setSkillsError: options.setSkillsError,
      setSkillsWarning: options.setSkillsWarning,
      setSkillRegistryError: options.setSkillRegistryError,
      setSkillRegistryWarning: options.setSkillRegistryWarning,
      setSkillRegistrySuccess: options.setSkillRegistrySuccess,
      setIsLoadingSkills: options.setIsLoadingSkills,
      setIsMutatingSkillRegistries: options.setIsMutatingSkillRegistries,
      loadSkills: options.loadSkills,
      updateRegistrySkill: options.updateRegistrySkill,
      logClientError: options.logClientError,
    };
  }

  return {
    async loadAvailableSkills(
      loadOptions: {
        clearStatus?: boolean;
        forceRefresh?: boolean;
      } = {},
    ): Promise<void> {
      await loadAvailableSkillsOperation(buildOperationDeps(), loadOptions);
    },

    applySkillsCatalogSnapshot(snapshot: SkillsCatalogSnapshot): void {
      applySkillsCatalogSnapshotOperation(buildOperationDeps(), snapshot);
    },

    async updateSkillRegistrySkill(updateOptions: {
      action: "install_registry_skill" | "delete_registry_skill";
      registryId: SkillRegistryId;
      skillName: string;
    }): Promise<void> {
      await updateSkillRegistrySkillOperation(
        buildOperationDeps(),
        updateOptions,
      );
    },

    handleReloadSkills(): void {
      handleReloadSkillsOperation(buildOperationDeps());
    },
  };
}
