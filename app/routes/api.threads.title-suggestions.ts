/**
 * API route module for /api/threads/title-suggestions.
 */
import type { Route } from "./+types/api.threads.title-suggestions";
import {
  createThreadTitleGenerationGateway,
} from "~/lib/server/infrastructure/gateways/chat/thread-title-generation-gateway";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  handleThreadTitleSuggestionAction,
  handleThreadTitleSuggestionLoader,
} from "~/lib/server/http/threads/thread-title-suggestion-action";
import {
  createThreadTitleSuggestionService,
} from "~/lib/server/usecase/threads/thread-title-suggestion-service";

function getThreadTitleSuggestionService() {
  return createThreadTitleSuggestionService(createThreadTitleGenerationGateway());
}

export function loader({}: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  return handleThreadTitleSuggestionLoader();
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

  return handleThreadTitleSuggestionAction({
    request,
    threadTitleSuggestionService: getThreadTitleSuggestionService(),
  });
}
