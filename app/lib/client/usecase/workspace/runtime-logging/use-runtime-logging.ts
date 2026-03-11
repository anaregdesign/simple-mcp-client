import {
  useEffect,
  useEffectEvent,
} from "react";
import {
  installGlobalClientErrorLogging,
} from "~/lib/client/infrastructure/browser/runtime-event-log-client";
import {
  createWorkspaceRuntimeLogging,
  type WorkspaceRuntimeLogReaders,
} from "~/lib/client/usecase/workspace/runtime-logging/logger";

export function useWorkspaceRuntimeLogging(
  readers: WorkspaceRuntimeLogReaders,
) {
  const logging = createWorkspaceRuntimeLogging(readers);
  const readRuntimeLogContext = useEffectEvent(() =>
    logging.buildRuntimeLogContext({
      source: "client",
    }),
  );

  useEffect(() => {
    return installGlobalClientErrorLogging(readRuntimeLogContext);
  }, []);

  return logging;
}
