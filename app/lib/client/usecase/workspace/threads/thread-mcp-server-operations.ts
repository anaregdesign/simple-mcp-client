import {
  type McpServerConfig,
} from "~/lib/contracts/mcp/profile";
import { buildMcpServerConfigKey } from "~/lib/domain/value-objects/mcp-server-config-key";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

export function connectMcpServerToThread(
  thread: ThreadState,
  serverToConnect: McpServerConfig,
): ThreadState {
  const nextKey = buildMcpServerConfigKey(serverToConnect);
  const existingIndex = thread.mcpServers.findIndex(
    (server) => buildMcpServerConfigKey(server) === nextKey,
  );
  if (existingIndex < 0) {
    return {
      ...thread,
      mcpServers: [...thread.mcpServers, serverToConnect],
    };
  }

  return {
    ...thread,
    mcpServers: thread.mcpServers.map((server, index) =>
      index === existingIndex
        ? {
            ...server,
            name: serverToConnect.name,
          }
        : server,
    ),
  };
}

export function removeThreadMcpServerById(
  thread: ThreadState,
  serverId: string,
): ThreadState {
  return {
    ...thread,
    mcpServers: thread.mcpServers.filter((server) => server.id !== serverId),
  };
}

export function removeThreadMcpServerByConfig(
  thread: ThreadState,
  serverToRemove: McpServerConfig,
): ThreadState {
  const deletedKey = buildMcpServerConfigKey(serverToRemove);
  return {
    ...thread,
    mcpServers: thread.mcpServers.filter(
      (server) => buildMcpServerConfigKey(server) !== deletedKey,
    ),
  };
}

export function toggleThreadMcpServer(
  thread: ThreadState,
  serverToToggle: McpServerConfig,
): ThreadState {
  const selectedKey = buildMcpServerConfigKey(serverToToggle);
  const alreadyConnected = thread.mcpServers.some(
    (server) => buildMcpServerConfigKey(server) === selectedKey,
  );
  if (alreadyConnected) {
    return {
      ...thread,
      mcpServers: thread.mcpServers.filter(
        (server) => buildMcpServerConfigKey(server) !== selectedKey,
      ),
    };
  }

  return {
    ...thread,
    mcpServers: [...thread.mcpServers, serverToToggle],
  };
}

export function reconcileSavedThreadMcpServer(
  thread: ThreadState,
  options: {
    previousServer: McpServerConfig;
    savedProfile: McpServerConfig;
  },
): ThreadState {
  const previousServerKey = buildMcpServerConfigKey(options.previousServer);
  const nextServerKey = buildMcpServerConfigKey(options.savedProfile);
  const filtered = thread.mcpServers.filter(
    (server) => buildMcpServerConfigKey(server) !== previousServerKey,
  );
  if (filtered.length === thread.mcpServers.length) {
    return thread;
  }

  const nextIndex = filtered.findIndex(
    (server) => buildMcpServerConfigKey(server) === nextServerKey,
  );
  if (nextIndex >= 0) {
    return {
      ...thread,
      mcpServers: filtered.map((server, index) =>
        index === nextIndex
          ? {
              ...server,
              name: options.savedProfile.name,
            }
          : server,
      ),
    };
  }

  return {
    ...thread,
    mcpServers: [...filtered, options.savedProfile],
  };
}
