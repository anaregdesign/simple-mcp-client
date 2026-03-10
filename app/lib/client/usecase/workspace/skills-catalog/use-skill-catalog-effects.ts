import {
  useEffect,
  useEffectEvent,
  useRef,
} from "react";

type ActiveAzurePrincipal = {
  tenantId: string;
  principalId: string;
} | null;

type UseWorkspaceSkillCatalogEffectsOptions = {
  activeAzurePrincipal: ActiveAzurePrincipal;
  isAzureAuthRequired: boolean;
  skillRegistryError: string | null;
  skillsError: string | null;
  loadAvailableSkills: () => Promise<void>;
};

export function useWorkspaceSkillCatalogEffects(
  options: UseWorkspaceSkillCatalogEffectsOptions,
) {
  const previousIsAzureAuthRequiredRef = useRef(options.isAzureAuthRequired);
  const lastLoadedSkillsUserKeyRef = useRef("");

  const reloadSkills = useEffectEvent(() => {
    void options.loadAvailableSkills();
  });

  useEffect(() => {
    reloadSkills();
  }, []);

  useEffect(() => {
    const wasAzureAuthRequired = previousIsAzureAuthRequiredRef.current;
    previousIsAzureAuthRequiredRef.current = options.isAzureAuthRequired;

    const tenantId = options.activeAzurePrincipal?.tenantId.trim() ?? "";
    const principalId = options.activeAzurePrincipal?.principalId.trim() ?? "";
    const activeUserKey =
      !options.isAzureAuthRequired && tenantId && principalId
        ? `${tenantId}::${principalId}`
        : "";

    if (!activeUserKey) {
      if (options.isAzureAuthRequired) {
        lastLoadedSkillsUserKeyRef.current = "";
      }
      return;
    }

    const hasAuthRequiredSkillsError =
      options.skillsError?.includes("Azure login is required.") === true ||
      options.skillRegistryError?.includes("Azure login is required.") === true;
    const shouldReloadForIdentityChange =
      lastLoadedSkillsUserKeyRef.current !== activeUserKey;
    if (
      !shouldReloadForIdentityChange &&
      !wasAzureAuthRequired &&
      !hasAuthRequiredSkillsError
    ) {
      return;
    }

    lastLoadedSkillsUserKeyRef.current = activeUserKey;
    reloadSkills();
  }, [
    options.activeAzurePrincipal?.principalId,
    options.activeAzurePrincipal?.tenantId,
    options.isAzureAuthRequired,
    options.skillRegistryError,
    options.skillsError,
  ]);
}
