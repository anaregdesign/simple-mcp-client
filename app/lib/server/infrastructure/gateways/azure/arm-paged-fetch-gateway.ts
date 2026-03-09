import type {
  AzureArmPagedFetchGateway,
  AzureArmPagedFetchLogEvent,
} from "~/lib/domain/repositories/azure-arm-paged-fetch-gateway";

type ArmPagedResponse<T> = {
  value?: T[];
  nextLink?: string;
};

export class AzureArmPagedFetchGatewayImpl
  implements AzureArmPagedFetchGateway
{
  async fetchPaged<T>(options: {
    url: string;
    accessToken: string;
    maxItems: number;
    logEvent: AzureArmPagedFetchLogEvent;
    abortSignal?: AbortSignal;
  }): Promise<T[]> {
    const items: T[] = [];
    let nextUrl = options.url;
    let pageNumber = 0;

    while (nextUrl && items.length < options.maxItems) {
      pageNumber += 1;
      const requestStartedAtMs = Date.now();

      let response: Response;
      try {
        response = await fetch(nextUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${options.accessToken}`,
          },
          signal: options.abortSignal,
        });
      } catch (error) {
        await options.logEvent({
          route: "/api/azure/projects",
          eventName: "azure_arm_api_call_failed",
          action: "fetch_arm_page",
          level: "warning",
          message: "Azure ARM API call failed before response.",
          error,
          context: {
            requestUrl: summarizeUrlForLog(nextUrl),
            durationMs: Date.now() - requestStartedAtMs,
            pageNumber,
          },
        });
        throw error;
      }

      const payload = (await response
        .json()
        .catch(() => null)) as ArmPagedResponse<T> | null;
      const requestDurationMs = Date.now() - requestStartedAtMs;
      if (!response.ok) {
        await options.logEvent({
          route: "/api/azure/projects",
          eventName: "azure_arm_api_call_failed",
          action: "fetch_arm_page",
          level: "warning",
          statusCode: response.status,
          message: "Azure ARM API call failed.",
          context: {
            requestUrl: summarizeUrlForLog(nextUrl),
            durationMs: requestDurationMs,
            pageNumber,
            statusText: response.statusText || null,
            armErrorMessage: readArmErrorMessage(payload) || null,
          },
        });
        throw new Error(
          readArmErrorMessage(payload) ||
            response.statusText ||
            "Azure ARM request failed.",
        );
      }

      const pageItems = Array.isArray(payload?.value) ? payload.value : [];
      const hasNextLink =
        typeof payload?.nextLink === "string" && payload.nextLink.length > 0;

      await options.logEvent({
        route: "/api/azure/projects",
        eventName: "azure_arm_api_call_succeeded",
        action: "fetch_arm_page",
        level: "info",
        statusCode: response.status,
        message: "Azure ARM API call succeeded.",
        context: {
          requestUrl: summarizeUrlForLog(nextUrl),
          durationMs: requestDurationMs,
          pageNumber,
          pageItemCount: pageItems.length,
          hasNextLink,
        },
      });

      const remaining = options.maxItems - items.length;
      items.push(...pageItems.slice(0, remaining));
      nextUrl = typeof payload?.nextLink === "string" ? payload.nextLink : "";
    }

    return items;
  }
}

export function createAzureArmPagedFetchGateway(): AzureArmPagedFetchGateway {
  return new AzureArmPagedFetchGatewayImpl();
}

function readArmErrorMessage(payload: unknown): string {
  if (!isRecord(payload)) {
    return "";
  }

  const errorValue = payload.error;
  if (!isRecord(errorValue)) {
    return "";
  }

  const message = errorValue.message;
  return typeof message === "string" ? message : "";
}

function summarizeUrlForLog(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const apiVersion = parsed.searchParams.get("api-version");
    return apiVersion
      ? `${parsed.origin}${parsed.pathname}?api-version=${apiVersion}`
      : `${parsed.origin}${parsed.pathname}`;
  } catch {
    return rawUrl.slice(0, 512);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
