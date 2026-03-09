/**
 * API route module for /api/instruction-patches.
 */
import type { Route } from "./+types/api.instruction-patches";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  handleInstructionPatchesAction,
  handleInstructionPatchesLoader,
} from "~/lib/server/http/instruction-patches/instruction-patches-action";

export function loader({}: Route.LoaderArgs) {
  installGlobalServerErrorLogging();
  return handleInstructionPatchesLoader();
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();
  return handleInstructionPatchesAction({
    request,
  });
}
