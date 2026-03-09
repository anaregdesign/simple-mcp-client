/**
 * Route module for OAuth metadata probe endpoints under /.well-known.
 */
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import { methodNotAllowedResponse } from "~/lib/server/http";

const unsupportedMetadataResponse = {
  error: "OAuth metadata is not configured for this Local Playground endpoint.",
  authConfigured: false,
};

export function loader() {
  installGlobalServerErrorLogging();

  return Response.json(
    unsupportedMetadataResponse,
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function action() {
  installGlobalServerErrorLogging();
  return methodNotAllowedResponse(["GET"]);
}
