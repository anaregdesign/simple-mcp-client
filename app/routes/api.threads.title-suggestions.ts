/**
 * API route module for /api/threads/title-suggestions.
 */
import type { Route } from "./+types/api.threads.title-suggestions";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  handleThreadTitleSuggestionAction,
  handleThreadTitleSuggestionLoader,
} from "~/lib/server/infrastructure/threads/thread-title-suggestion-action";
import {
  createThreadTitleSuggestionServiceWithInfrastructure,
} from "~/lib/server/infrastructure/threads/thread-service-factory";

export function loader({}: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  return handleThreadTitleSuggestionLoader();
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

  return handleThreadTitleSuggestionAction({
    request,
    threadTitleSuggestionService:
      createThreadTitleSuggestionServiceWithInfrastructure(),
  });
}
