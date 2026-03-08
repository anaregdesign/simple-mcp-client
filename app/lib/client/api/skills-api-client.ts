import {
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/controller/api-client";
import { readJsonPayload } from "~/lib/client/controller/http";
import type { SkillsApiResponse } from "~/lib/client/controller/types";
import { readStringList } from "~/lib/client/shared/collections";
import {
  readSkillCatalogList,
  readSkillRegistryCatalogList,
} from "~/lib/client/skills/parsers";
import type { SkillRegistryId } from "~/lib/client/skills/registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
} from "~/lib/client/skills/types";

export type SkillsCatalogSnapshot = {
  skills: SkillCatalogEntry[];
  skillRegistries: SkillRegistryCatalog[];
  skillWarnings: string[];
  registryWarnings: string[];
  warnings: string[];
  message: string | null;
  payload: SkillsApiResponse;
};

type SkillsApiClientOptions = {
  onAuthRequired?: () => void;
  fetchImpl?: typeof fetch;
};

type UpdateSkillRegistrySkillOptions = SkillsApiClientOptions & {
  action: "install_registry_skill" | "delete_registry_skill";
  registryId: SkillRegistryId;
  skillName: string;
};

export class SkillsApiClient {
  async loadSkills(
    options: SkillsApiClientOptions & {
      forceRefresh?: boolean;
    } = {},
  ): Promise<SkillsCatalogSnapshot> {
    const requestUrl = options.forceRefresh === true ? "/api/skills?refresh=1" : "/api/skills";
    const { payload } = await requestClientApi<SkillsApiResponse>({
      url: requestUrl,
      init: {
        method: "GET",
      },
      readPayload: (response) => readJsonPayload<SkillsApiResponse>(response, "Skills"),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to load Skills.",
      authRequiredMessage: "Azure login is required. Open Settings and sign in to load Skills.",
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    return readSkillsCatalogSnapshot(payload);
  }

  async updateRegistrySkill(
    options: UpdateSkillRegistrySkillOptions,
  ): Promise<SkillsCatalogSnapshot> {
    const { payload } = await requestClientApi<SkillsApiResponse>({
      url: buildSkillRegistrySkillApiPath(options.registryId, options.skillName),
      init: {
        method: options.action === "install_registry_skill" ? "PUT" : "DELETE",
      },
      readPayload: (response) => readJsonPayload<SkillsApiResponse>(response, "Skills"),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to update Skill registry.",
      authRequiredMessage:
        "Azure login is required. Open Settings and sign in to update Skill registries.",
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    return readSkillsCatalogSnapshot(payload);
  }
}

export const skillsApiClient = new SkillsApiClient();

function readSkillsCatalogSnapshot(payload: SkillsApiResponse): SkillsCatalogSnapshot {
  return {
    skills: readSkillCatalogList(payload.skills),
    skillRegistries: readSkillRegistryCatalogList(payload.registries),
    skillWarnings: readStringList(payload.skillWarnings),
    registryWarnings: readStringList(payload.registryWarnings),
    warnings: readStringList(payload.warnings),
    message: typeof payload.message === "string" && payload.message.trim() ? payload.message : null,
    payload,
  };
}

function buildSkillRegistrySkillApiPath(
  registryId: SkillRegistryId,
  skillName: string,
): string {
  const encodedSkillPath = skillName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/skills/registries/${encodeURIComponent(registryId)}/skills/${encodedSkillPath}`;
}
