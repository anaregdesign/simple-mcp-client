import {
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/infrastructure/api/api-client";
import { readJsonPayload } from "~/lib/client/infrastructure/api/http";
import type { SkillsApiResponse } from "~/lib/client/usecase/workspace/types";
import {
  readSkillCatalogList,
  readSkillRegistryCatalogList,
} from "~/lib/contracts/skills/parsers";
import type { SkillRegistryId } from "~/lib/contracts/skills/registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
} from "~/lib/contracts/skills/types";

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

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const normalized = entry.trim();
    if (!normalized) {
      continue;
    }

    result.push(normalized);
  }

  return result;
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
