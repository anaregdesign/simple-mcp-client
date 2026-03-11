import {
  runtimeEventLogPersistenceRepository,
} from "~/lib/server/infrastructure/repositories/runtime-event-log-persistence-repository";
import {
  createRuntimeEventLogService,
} from "~/lib/server/usecase/runtime-event-logs/runtime-event-log-service";

export function createRuntimeEventLogServiceWithInfrastructure() {
  return createRuntimeEventLogService(runtimeEventLogPersistenceRepository);
}
