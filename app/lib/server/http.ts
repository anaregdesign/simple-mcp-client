/**
 * Shared HTTP response helpers for API routes.
 */
import type {
  ApiErrorResponseBody as StructuredApiErrorResponseBody,
  ApiSuccessResponseBody,
} from "~/lib/contracts/api/response";

export type ApiErrorResponseBody = {
  code: string;
  error: string;
};

type ApiErrorResponseOptions = {
  status: number;
  code: string;
  error: string;
  headers?: HeadersInit;
  extras?: Record<string, unknown>;
};

const defaultAuthRequiredMessage = "Azure login is required. Click Azure Login to continue.";

type StructuredApiErrorResponseOptions<TDetails = unknown> = {
  status: number;
  code: string;
  message: string;
  details?: TDetails;
  headers?: HeadersInit;
};

export function errorResponse(options: ApiErrorResponseOptions): Response {
  const { status, code, error, headers, extras } = options;
  return Response.json(
    {
      code,
      error,
      ...(extras ?? {}),
    },
    {
      status,
      headers,
    },
  );
}

export function successResponse<TData, TMeta = never>(
  data: TData,
  options: {
    status?: number;
    headers?: HeadersInit;
    meta?: TMeta;
  } = {},
): Response {
  const body =
    options.meta === undefined
      ? { data }
      : { data, meta: options.meta };

  return Response.json(body, {
    status: options.status ?? 200,
    headers: options.headers,
  });
}

export function structuredErrorResponse<TDetails = unknown>(
  options: StructuredApiErrorResponseOptions<TDetails>,
): Response {
  const body: StructuredApiErrorResponseBody<TDetails> = {
    error: {
      code: options.code,
      message: options.message,
      ...(options.details === undefined ? {} : { details: options.details }),
    },
  };

  return Response.json(body, {
    status: options.status,
    headers: options.headers,
  });
}

export function structuredAuthRequiredResponse(
  message = defaultAuthRequiredMessage,
): Response {
  return structuredErrorResponse({
    status: 401,
    code: "auth_required",
    message,
  });
}

export function authRequiredResponse(message = defaultAuthRequiredMessage): Response {
  return errorResponse({
    status: 401,
    code: "auth_required",
    error: message,
    extras: {
      authRequired: true,
    },
  });
}

export function invalidJsonResponse(): Response {
  return errorResponse({
    status: 400,
    code: "invalid_json_body",
    error: "Invalid JSON body.",
  });
}

export function validationErrorResponse(code: string, error: string): Response {
  return errorResponse({
    status: 422,
    code,
    error,
  });
}

export function methodNotAllowedResponse(allowedMethods: readonly string[]): Response {
  return errorResponse({
    status: 405,
    code: "method_not_allowed",
    error: "Method not allowed.",
    headers: {
      Allow: allowedMethods.join(", "),
    },
  });
}
