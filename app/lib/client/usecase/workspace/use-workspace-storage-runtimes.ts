import { useRef } from "react";
import {
  createWorkspaceMcpProfileStorageRuntime,
} from "~/lib/client/usecase/workspace/mcp-profiles/storage-runtime";
import {
  createThreadStorageRuntime,
} from "~/lib/client/usecase/workspace/threads/storage-runtime";

type WorkspaceMcpProfileStorageRuntimeOptions = Omit<
  Parameters<typeof createWorkspaceMcpProfileStorageRuntime>[0],
  "nextWorkspaceMcpServerProfileRequestSeq" | "readWorkspaceMcpServerProfileRequestSeq"
>;
type ThreadStorageRuntimeOptions = Parameters<typeof createThreadStorageRuntime>[0];

type UseWorkspaceStorageRuntimesOptions = {
  workspaceMcpProfile: WorkspaceMcpProfileStorageRuntimeOptions;
  threadStorage: ThreadStorageRuntimeOptions;
};

export function useWorkspaceStorageRuntimes(
  options: UseWorkspaceStorageRuntimesOptions,
) {
  const workspaceMcpServerProfileRequestSeqRef = useRef(0);

  const workspaceMcpProfileStorageRuntime =
    createWorkspaceMcpProfileStorageRuntime({
      ...options.workspaceMcpProfile,
      nextWorkspaceMcpServerProfileRequestSeq: () => {
        const requestSeq = workspaceMcpServerProfileRequestSeqRef.current + 1;
        workspaceMcpServerProfileRequestSeqRef.current = requestSeq;
        return requestSeq;
      },
      readWorkspaceMcpServerProfileRequestSeq: () =>
        workspaceMcpServerProfileRequestSeqRef.current,
    });

  const threadStorageRuntime = createThreadStorageRuntime(options.threadStorage);

  return {
    workspaceMcpProfileStorageRuntime,
    threadStorageRuntime,
  };
}
