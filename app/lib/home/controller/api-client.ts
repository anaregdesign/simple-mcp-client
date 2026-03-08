/**
 * Client controller API client helpers.
 */

export type HomeApiErrorKind = "auth_required" | "http_error" | "network_error";

export class HomeApiError extends Error {
  readonly kind: HomeApiErrorKind;
  readonly status: number | null;
  readonly payload: unknown;

  constructor(options: {
    kind: HomeApiErrorKind;
    message: string;
    status?: number | null;
    payload?: unknown;
  }) {
    super(options.message);
    this.name = "HomeApiError";
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.payload = options.payload;
  }
}

export async function requestHomeApi<TPayload>(options: {
  url: string;
  init?: RequestInit;
  readPayload: (response: Response) => Promise<TPayload>;
  resolveAuthRequired: (status: number, payload: TPayload) => boolean;
  readErrorMessage: (payload: TPayload) => string | null;
  fallbackErrorMessage: string;
  authRequiredMessage?: string;
  onAuthRequired?: () => void;
  fetchImpl?: typeof fetch;
}): Promise<{
  response: Response;
  payload: TPayload;
}> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(options.url, options.init);
  } catch (error) {
    throw new HomeApiError({
      kind: "network_error",
      message: mapApiError(error, options.fallbackErrorMessage),
      payload: error,
    });
  }

  const payload = await options.readPayload(response);
  if (!response.ok) {
    const authRequired = options.resolveAuthRequired(response.status, payload);
    if (authRequired) {
      options.onAuthRequired?.();
      throw new HomeApiError({
        kind: "auth_required",
        status: response.status,
        message: options.authRequiredMessage ?? "Azure login is required.",
        payload,
      });
    }

    throw new HomeApiError({
      kind: "http_error",
      status: response.status,
      message: options.readErrorMessage(payload) ?? options.fallbackErrorMessage,
      payload,
    });
  }

  return {
    response,
    payload,
  };
}

export function resolveAuthRequired(
  status: number,
  payload: unknown,
  isAuthRequiredPayload?: (payload: unknown) => boolean,
): boolean {
  if (typeof isAuthRequiredPayload === "function" && isAuthRequiredPayload(payload)) {
    return true;
  }

  if (status === 401) {
    return true;
  }

  if (!isRecord(payload)) {
    return false;
  }

  return payload.authRequired === true;
}

export function mapApiError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
