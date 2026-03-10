import { ClientApiError, mapApiError } from "~/lib/client/infrastructure/api/api-client";
import type { SkillsCatalogSnapshot } from "~/lib/client/infrastructure/api/skills-api-client";
import { CLIENT_SKILLS_RELOAD_MIN_INTERVAL_MS } from "~/lib/constants/skills";
import type { SkillRegistryId } from "~/lib/contracts/skills/registry";
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

type SkillCatalogOperationsDependencies = {
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

export function applySkillsCatalogSnapshot(
  deps: SkillCatalogOperationsDependencies,
  snapshot: SkillsCatalogSnapshot,
): void {
  deps.setAvailableSkills(snapshot.skills);
  deps.setSkillRegistryCatalogs(snapshot.skillRegistries);
  deps.setSkillsError(null);
  deps.setSkillRegistryError(null);
  deps.setSkillsWarning(
    snapshot.skillWarnings.length > 0
      ? snapshot.skillWarnings.slice(0, 2).join("\n")
      : null,
  );
  deps.setSkillRegistryWarning(
    snapshot.registryWarnings.length > 0
      ? snapshot.registryWarnings.slice(0, 2).join("\n")
      : null,
  );
}

export async function loadAvailableSkills(
  deps: SkillCatalogOperationsDependencies,
  options: {
    clearStatus?: boolean;
    forceRefresh?: boolean;
  } = {},
): Promise<void> {
  const expectedUserKey = deps.readActiveWorkspaceUserKey().trim();
  const requestSeq = deps.nextSkillsRequestSeq();

  if (options.clearStatus !== false) {
    deps.setSkillsError(null);
    deps.setSkillsWarning(null);
    deps.setSkillRegistryError(null);
    deps.setSkillRegistryWarning(null);
    deps.setSkillRegistrySuccess(null);
  }
  deps.setIsLoadingSkills(true);

  try {
    const result = await deps.loadSkills({
      forceRefresh: options.forceRefresh,
      onAuthRequired: () => {
        deps.markAzureAuthRequired();
        deps.setAvailableSkills([]);
        deps.setSkillRegistryCatalogs([]);
        deps.setSkillsError(
          "Azure login is required. Open Settings and sign in to load Skills.",
        );
        deps.setSkillRegistryError(
          "Azure login is required. Open Settings and sign in to load Skills.",
        );
      },
    });

    if (requestSeq !== deps.readSkillsRequestSeq()) {
      return;
    }
    if (expectedUserKey !== deps.readActiveWorkspaceUserKey().trim()) {
      return;
    }

    deps.resolveAzureBackgroundSuccess();
    applySkillsCatalogSnapshot(deps, result);
    deps.setSkillRegistrySuccess(null);
  } catch (loadError) {
    if (requestSeq !== deps.readSkillsRequestSeq()) {
      return;
    }
    if (expectedUserKey !== deps.readActiveWorkspaceUserKey().trim()) {
      return;
    }
    if (
      loadError instanceof ClientApiError &&
      loadError.kind === "auth_required"
    ) {
      return;
    }

    deps.logClientError("load_skills_failed", loadError, {
      action: "load_skills",
    });
    deps.setAvailableSkills([]);
    deps.setSkillRegistryCatalogs([]);
    deps.setSkillsError(mapApiError(loadError, "Failed to load Skills."));
    deps.setSkillRegistryError(
      mapApiError(loadError, "Failed to load Skill registries."),
    );
  } finally {
    if (requestSeq === deps.readSkillsRequestSeq()) {
      deps.setIsLoadingSkills(false);
    }
  }
}

export function handleReloadSkills(
  deps: SkillCatalogOperationsDependencies,
): void {
  const now = Date.now();
  if (
    now - deps.readLastManualReloadAt() <
    CLIENT_SKILLS_RELOAD_MIN_INTERVAL_MS
  ) {
    return;
  }

  deps.setLastManualReloadAt(now);
  void loadAvailableSkills(deps, {
    forceRefresh: true,
  });
}

export async function updateSkillRegistrySkill(
  deps: SkillCatalogOperationsDependencies,
  options: {
    action: "install_registry_skill" | "delete_registry_skill";
    registryId: SkillRegistryId;
    skillName: string;
  },
): Promise<void> {
  deps.setIsMutatingSkillRegistries(true);
  deps.setSkillRegistryError(null);
  deps.setSkillRegistrySuccess(null);

  try {
    const result = await deps.updateRegistrySkill({
      action: options.action,
      registryId: options.registryId,
      skillName: options.skillName,
      onAuthRequired: () => {
        deps.markAzureAuthRequired();
      },
    });

    deps.resolveAzureBackgroundSuccess();
    applySkillsCatalogSnapshot(deps, result);
    deps.setSkillRegistrySuccess(result.message);
  } catch (error) {
    if (error instanceof ClientApiError && error.kind === "auth_required") {
      deps.setSkillRegistryError(error.message);
      return;
    }

    deps.logClientError("update_skill_registry_failed", error, {
      action: options.action,
      context: {
        registryId: options.registryId,
        skillName: options.skillName,
      },
    });
    deps.setSkillRegistryError(
      mapApiError(error, "Failed to update Skill registry."),
    );
  } finally {
    deps.setIsMutatingSkillRegistries(false);
  }
}
