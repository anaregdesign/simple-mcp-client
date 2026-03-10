import {
  isSkillRegistryId,
  parseSkillRegistrySkillName,
  readSkillRegistrySkillNameValidationMessage,
  type SkillRegistryId,
} from "~/lib/contracts/skills/registry";

export type SkillRegistryMutationPayload = {
  registryId: SkillRegistryId;
  skillName: string;
};

export type WorkspaceSkillProfileReconcilePayload = {
  forceRefresh: boolean;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function readSkillRegistryRefreshQueryFlag(requestUrl: string): boolean {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(requestUrl);
  } catch {
    return false;
  }

  const refreshFlag = parsedUrl.searchParams.get("refresh")?.trim().toLowerCase() ?? "";
  return refreshFlag === "1" || refreshFlag === "true" || refreshFlag === "yes";
}

export async function readWorkspaceSkillProfileReconcilePayload(
  request: Request,
): Promise<ParseResult<WorkspaceSkillProfileReconcilePayload>> {
  const contentType = request.headers.get("content-type")?.trim().toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    const content = (await request.text().catch(() => "")).trim();
    if (!content) {
      return {
        ok: true,
        value: {
          forceRefresh: false,
        },
      };
    }

    return {
      ok: false,
      error: "Request body must be JSON.",
    };
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      error: "Request body must be valid JSON.",
    };
  }

  return readWorkspaceSkillProfileReconcilePayloadFromUnknown(payload);
}

export function readWorkspaceSkillProfileReconcilePayloadFromUnknown(
  payload: unknown,
): ParseResult<WorkspaceSkillProfileReconcilePayload> {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: "Request body must be a JSON object.",
    };
  }

  const forceRefreshValue = payload.forceRefresh;
  if (forceRefreshValue === undefined) {
    return {
      ok: true,
      value: {
        forceRefresh: false,
      },
    };
  }
  if (typeof forceRefreshValue !== "boolean") {
    return {
      ok: false,
      error: "`forceRefresh` must be a boolean.",
    };
  }

  return {
    ok: true,
    value: {
      forceRefresh: forceRefreshValue,
    },
  };
}

export function parseSkillRegistryMutationPath(
  registryIdInput: string,
  skillNameInput: string,
): ParseResult<SkillRegistryMutationPayload> {
  const registryId = registryIdInput.trim();
  if (!isSkillRegistryId(registryId)) {
    return {
      ok: false,
      error: "`registryId` is invalid.",
    };
  }

  const skillName = skillNameInput.trim();
  const parsedSkillName = parseSkillRegistrySkillName(registryId, skillName);
  if (!parsedSkillName) {
    return {
      ok: false,
      error: readSkillRegistrySkillNameValidationMessage(registryId),
    };
  }

  return {
    ok: true,
    value: {
      registryId,
      skillName: parsedSkillName.normalizedSkillName,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
