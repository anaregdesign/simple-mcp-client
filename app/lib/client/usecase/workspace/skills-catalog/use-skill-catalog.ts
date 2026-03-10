import {
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject } from "react";
import {
  createSkillCatalogController,
} from "~/lib/client/usecase/workspace/skills-catalog/controller";
import {
  useWorkspaceSkillCatalogEffects,
} from "~/lib/client/usecase/workspace/skills-catalog/effects";
import {
  createSkillSelectionHandlers,
} from "~/lib/client/usecase/workspace/skills-catalog/handlers";
import {
  buildMessageSkillActivationOptions,
  buildSkillRegistryGroups,
  buildThreadSkillOptions,
} from "~/lib/client/usecase/workspace/skills-catalog/selectors";
import {
  skillsApiClient,
} from "~/lib/client/infrastructure/api/skills-api-client";
import type { SkillRegistryId } from "~/lib/domain/value-objects/skill-registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
  ThreadSkillActivation,
} from "~/lib/contracts/skills/types";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

type ActiveAzurePrincipal = {
  tenantId: string;
  principalId: string;
} | null;

type UseSkillCatalogOptions = {
  activeWorkspaceUserKeyRef: MutableRefObject<string>;
  activeAzurePrincipal: ActiveAzurePrincipal;
  isAzureAuthRequired: boolean;
  markAzureAuthRequired: () => void;
  resolveAzureBackgroundSuccess: () => void;
  readActiveThreadId: () => string;
  updateThreadStateById: (
    threadId: string,
    updater: (thread: ThreadState) => ThreadState,
  ) => void;
  selectedThreadSkills: ThreadSkillActivation[];
  selectedMessageSkillActivations: ThreadSkillActivation[];
  setSelectedMessageSkillActivations: (
    updater: (
      current: ThreadSkillActivation[],
    ) => ThreadSkillActivation[],
  ) => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: {
      category?: string;
      location?: string;
      action?: string;
      statusCode?: number;
      context?: Record<string, unknown>;
    },
  ) => void;
};

export function useSkillCatalog(options: UseSkillCatalogOptions) {
  const skillsRequestSeqRef = useRef(0);
  const lastManualSkillsReloadAtRef = useRef(0);
  const [availableSkills, setAvailableSkills] = useState<SkillCatalogEntry[]>(
    [],
  );
  const [skillRegistryCatalogs, setSkillRegistryCatalogs] = useState<
    SkillRegistryCatalog[]
  >([]);
  const [isMutatingSkillRegistries, setIsMutatingSkillRegistries] =
    useState(false);
  const [skillRegistryError, setSkillRegistryError] = useState<string | null>(
    null,
  );
  const [skillRegistryWarning, setSkillRegistryWarning] = useState<
    string | null
  >(null);
  const [skillRegistrySuccess, setSkillRegistrySuccess] = useState<
    string | null
  >(null);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillsWarning, setSkillsWarning] = useState<string | null>(null);

  const controller = createSkillCatalogController({
    activeWorkspaceUserKeyRef: options.activeWorkspaceUserKeyRef,
    skillsRequestSeqRef,
    lastManualSkillsReloadAtRef,
    markAzureAuthRequired: options.markAzureAuthRequired,
    resolveAzureBackgroundSuccess: options.resolveAzureBackgroundSuccess,
    setAvailableSkills,
    setSkillRegistryCatalogs,
    setSkillsError,
    setSkillsWarning,
    setSkillRegistryError,
    setSkillRegistryWarning,
    setSkillRegistrySuccess,
    setIsLoadingSkills,
    setIsMutatingSkillRegistries,
    loadSkills: (requestOptions) => skillsApiClient.loadSkills(requestOptions),
    updateRegistrySkill: (requestOptions) =>
      skillsApiClient.updateRegistrySkill(requestOptions),
    logClientError: options.logClientError,
  });

  useWorkspaceSkillCatalogEffects({
    activeAzurePrincipal: options.activeAzurePrincipal,
    isAzureAuthRequired: options.isAzureAuthRequired,
    skillRegistryError,
    skillsError,
    loadAvailableSkills: controller.loadAvailableSkills,
  });

  const availableSkillByLocation = useMemo(
    () =>
      new Map(availableSkills.map((skill) => [skill.location, skill] as const)),
    [availableSkills],
  );
  const threadSkillOptions = useMemo(
    () =>
      buildThreadSkillOptions({
        availableSkills,
        selectedThreadSkills: options.selectedThreadSkills,
      }),
    [availableSkills, options.selectedThreadSkills],
  );
  const messageSkillActivationOptions = useMemo(
    () =>
      buildMessageSkillActivationOptions({
        availableSkills,
        selectedMessageSkillActivations:
          options.selectedMessageSkillActivations,
      }),
    [availableSkills, options.selectedMessageSkillActivations],
  );
  const skillRegistryGroups = useMemo(
    () => buildSkillRegistryGroups(skillRegistryCatalogs),
    [skillRegistryCatalogs],
  );

  const {
    handleToggleRegistrySkill,
    handleAddMessageSkillActivation,
    handleRemoveMessageSkillActivation,
    handleAddThreadSkill,
    handleRemoveThreadSkill,
    handleToggleThreadSkill,
  } = createSkillSelectionHandlers({
    availableSkillByLocation,
    skillRegistryCatalogs,
    readActiveThreadId: options.readActiveThreadId,
    updateThreadStateById: options.updateThreadStateById,
    setSelectedMessageSkillActivations:
      options.setSelectedMessageSkillActivations,
    setSkillsError,
    updateSkillRegistrySkill: (updateOptions) =>
      controller.updateSkillRegistrySkill(updateOptions),
  });

  return {
    availableSkills,
    skillRegistryCatalogs,
    isMutatingSkillRegistries,
    skillRegistryError,
    setSkillRegistryError,
    skillRegistryWarning,
    setSkillRegistryWarning,
    skillRegistrySuccess,
    setSkillRegistrySuccess,
    isLoadingSkills,
    skillsError,
    setSkillsError,
    skillsWarning,
    setSkillsWarning,
    threadSkillOptions,
    messageSkillActivationOptions,
    skillRegistryGroups,
    loadAvailableSkills: controller.loadAvailableSkills,
    handleReloadSkills: () => {
      controller.handleReloadSkills();
    },
    handleToggleRegistrySkill: (
      registryId: SkillRegistryId,
      skillIdRaw: string,
    ) => {
      handleToggleRegistrySkill(registryId, skillIdRaw);
    },
    handleAddMessageSkillActivation: (locationRaw: string) => {
      handleAddMessageSkillActivation(locationRaw);
    },
    handleRemoveMessageSkillActivation: (locationRaw: string) => {
      handleRemoveMessageSkillActivation(locationRaw);
    },
    handleAddThreadSkill: (locationRaw: string) => {
      handleAddThreadSkill(locationRaw);
    },
    handleRemoveThreadSkill: (locationRaw: string) => {
      handleRemoveThreadSkill(locationRaw);
    },
    handleToggleThreadSkill: (locationRaw: string) => {
      handleToggleThreadSkill(locationRaw);
    },
  };
}
