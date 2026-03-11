import {
  createThreadTitleGenerationGateway,
} from "~/lib/server/infrastructure/gateways/chat/thread-title-generation-gateway";
import {
  createThreadPersistenceRepository,
} from "~/lib/server/infrastructure/repositories/thread-persistence-repository";
import {
  createThreadApplicationService,
  createThreadQueryService,
} from "~/lib/server/usecase/threads/thread-service";
import {
  createThreadTitleSuggestionService,
} from "~/lib/server/usecase/threads/thread-title-suggestion-service";

export function createThreadServicesWithInfrastructure() {
  const repository = createThreadPersistenceRepository();
  return {
    threadApplicationService: createThreadApplicationService(repository),
    threadQueryService: createThreadQueryService(repository),
  };
}

export function createThreadApplicationServiceWithInfrastructure() {
  return createThreadApplicationService(createThreadPersistenceRepository());
}

export function createThreadQueryServiceWithInfrastructure() {
  return createThreadQueryService(createThreadPersistenceRepository());
}

export function createThreadTitleSuggestionServiceWithInfrastructure() {
  return createThreadTitleSuggestionService(createThreadTitleGenerationGateway());
}
