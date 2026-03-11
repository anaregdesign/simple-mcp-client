import {
  useWorkspaceScreenFeatures,
} from "~/lib/client/usecase/workspace/use-workspace-screen-features";
import {
  useWorkspaceScreenRuntime,
} from "~/lib/client/usecase/workspace/use-workspace-screen-runtime";

/**
 * Client runtime controller.
 * Owns interactive state for Playground/Threads/MCP/Settings and orchestrates server API calls.
 * This hook intentionally keeps state ownership centralized while delegating pure transforms
 * to modules under `~/lib/client/*`.
 */
export function useWorkspace() {
  const runtime = useWorkspaceScreenRuntime();
  const screen = useWorkspaceScreenFeatures(runtime);

  return {
    screen,
  };
}
