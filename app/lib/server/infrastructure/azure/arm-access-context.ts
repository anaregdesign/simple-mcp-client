import { getAzureDependencies } from "~/lib/server/infrastructure/azure/dependencies";
import {
  readAzureArmUserContext,
  type AzurePrincipalType,
} from "~/lib/server/infrastructure/auth/azure-arm-user-context";
import {
  AZURE_ARM_SCOPE,
  AZURE_GRAPH_SCOPE,
} from "~/lib/constants/azure";
import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type { AzureDependencies } from "~/lib/server/infrastructure/azure/dependencies";

const AZURE_PROJECTS_ROUTE = "/api/azure/projects";

export type AzurePrincipalProfile = {
  tenantId: string;
  principalId: string;
  displayName: string;
  principalName: string;
  principalType: AzurePrincipalType;
};

export type ArmAccessTokenResult =
  | {
      ok: true;
      token: string;
      tenantId: string;
      principalId: string;
      displayName: string;
      principalName: string;
      principalType: AzurePrincipalType;
    }
  | { ok: false };

type GraphMeResponse = {
  id?: string;
  displayName?: string;
  userPrincipalName?: string;
  mail?: string;
};

export async function getArmAccessToken(
  dependencies: AzureDependencies = getAzureDependencies(),
  preferredTenantId = "",
): Promise<ArmAccessTokenResult> {
  const normalizedPreferredTenantId = preferredTenantId.trim();
  let userContext = await readAzureArmUserContext(
    dependencies,
    normalizedPreferredTenantId,
  );
  if (!userContext) {
    return { ok: false };
  }

  if (
    normalizedPreferredTenantId &&
    userContext.tenantId.toLowerCase() !==
      normalizedPreferredTenantId.toLowerCase()
  ) {
    try {
      await dependencies.authenticateAzure(
        AZURE_ARM_SCOPE,
        normalizedPreferredTenantId,
      );
    } catch {
      return { ok: false };
    }

    userContext = await readAzureArmUserContext(
      dependencies,
      normalizedPreferredTenantId,
    );
    if (
      !userContext ||
      userContext.tenantId.toLowerCase() !==
        normalizedPreferredTenantId.toLowerCase()
    ) {
      return { ok: false };
    }
  }

  return {
    ok: true,
    token: userContext.token,
    tenantId: userContext.tenantId,
    principalId: userContext.principalId,
    displayName: userContext.displayName,
    principalName: userContext.principalName,
    principalType: userContext.principalType,
  };
}

export async function resolveAzurePrincipalProfile(
  accessContext: Extract<ArmAccessTokenResult, { ok: true }>,
  dependencies: AzureDependencies = getAzureDependencies(),
): Promise<AzurePrincipalProfile> {
  const fallbackProfile: AzurePrincipalProfile = {
    tenantId: accessContext.tenantId,
    principalId: accessContext.principalId,
    displayName: accessContext.displayName,
    principalName: accessContext.principalName,
    principalType: accessContext.principalType,
  };

  if (
    accessContext.principalType === "servicePrincipal" ||
    accessContext.principalType === "managedIdentity"
  ) {
    return normalizeAzurePrincipalProfile(fallbackProfile);
  }

  let graphToken = "";
  try {
    graphToken = await dependencies.getAzureBearerToken(AZURE_GRAPH_SCOPE);
  } catch {
    return normalizeAzurePrincipalProfile(fallbackProfile);
  }

  if (!graphToken) {
    return normalizeAzurePrincipalProfile(fallbackProfile);
  }

  try {
    const graphRequestStartedAtMs = Date.now();
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${graphToken}`,
        },
      },
    );
    const graphRequestDurationMs = Date.now() - graphRequestStartedAtMs;
    const payload = (await response
      .json()
      .catch(() => null)) as GraphMeResponse | null;
    if (!response.ok) {
      await logServerRouteEvent({
        route: AZURE_PROJECTS_ROUTE,
        eventName: "azure_graph_api_call_failed",
        action: "load_graph_profile",
        level: "warning",
        statusCode: response.status,
        message: "Microsoft Graph API call failed.",
        context: {
          requestUrl: summarizeUrlForLog(
            "https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail",
          ),
          durationMs: graphRequestDurationMs,
          statusText: response.statusText || null,
        },
      });
      return normalizeAzurePrincipalProfile(fallbackProfile);
    }

    await logServerRouteEvent({
      route: AZURE_PROJECTS_ROUTE,
      eventName: "azure_graph_api_call_succeeded",
      action: "load_graph_profile",
      level: "info",
      statusCode: response.status,
      message: "Microsoft Graph API call succeeded.",
      context: {
        requestUrl: summarizeUrlForLog(
          "https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail",
        ),
        durationMs: graphRequestDurationMs,
      },
    });

    const graphPrincipalId =
      typeof payload?.id === "string" ? payload.id.trim() : "";
    const graphDisplayName =
      typeof payload?.displayName === "string"
        ? payload.displayName.trim()
        : "";
    const graphPrincipalName =
      typeof payload?.userPrincipalName === "string"
        ? payload.userPrincipalName.trim()
        : typeof payload?.mail === "string"
          ? payload.mail.trim()
          : "";

    return normalizeAzurePrincipalProfile({
      tenantId: fallbackProfile.tenantId,
      principalId: graphPrincipalId || fallbackProfile.principalId,
      displayName: graphDisplayName || fallbackProfile.displayName,
      principalName: graphPrincipalName || fallbackProfile.principalName,
      principalType:
        fallbackProfile.principalType === "unknown"
          ? "user"
          : fallbackProfile.principalType,
    });
  } catch (error) {
    await logServerRouteEvent({
      route: AZURE_PROJECTS_ROUTE,
      eventName: "azure_graph_api_call_failed",
      action: "load_graph_profile",
      level: "warning",
      message: "Microsoft Graph API call failed.",
      error,
      context: {
        requestUrl: summarizeUrlForLog(
          "https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail",
        ),
      },
    });
    return normalizeAzurePrincipalProfile(fallbackProfile);
  }
}

function normalizeAzurePrincipalProfile(
  profile: AzurePrincipalProfile,
): AzurePrincipalProfile {
  const tenantId = profile.tenantId.trim();
  const principalId = profile.principalId.trim();
  const principalName = profile.principalName.trim();
  const displayName =
    profile.displayName.trim() || principalName || principalId;

  return {
    tenantId,
    principalId,
    displayName,
    principalName,
    principalType: profile.principalType,
  };
}

function summarizeUrlForLog(rawUrl: string): string {
  try {
    const parsedUrl = new URL(rawUrl);
    const path =
      parsedUrl.pathname.length > 120
        ? `${parsedUrl.pathname.slice(0, 117)}...`
        : parsedUrl.pathname;
    return `${parsedUrl.origin}${path}`;
  } catch {
    return rawUrl.slice(0, 160);
  }
}
