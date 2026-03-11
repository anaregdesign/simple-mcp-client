import { buildMcpServerConfigKey } from "~/lib/domain/value-objects/mcp-server-config-key";
import type { McpServerConfig } from "~/lib/domain/value-objects/mcp-server-config";

export function connectThreadMcpServer<Server extends McpServerConfig>(
  currentServers: readonly Server[],
  serverToConnect: Server,
): Server[] {
  const nextKey = buildMcpServerConfigKey(serverToConnect);
  const existingIndex = currentServers.findIndex(
    (server) => buildMcpServerConfigKey(server) === nextKey,
  );
  if (existingIndex < 0) {
    return [...currentServers, serverToConnect];
  }

  return currentServers.map((server, index) =>
    index === existingIndex
      ? {
          ...server,
          name: serverToConnect.name,
        }
      : server,
  );
}

export function removeThreadMcpServerById<Server extends McpServerConfig>(
  currentServers: readonly Server[],
  serverId: string,
): Server[] {
  return currentServers.filter((server) => server.id !== serverId);
}

export function removeThreadMcpServerByConfig<Server extends McpServerConfig>(
  currentServers: readonly Server[],
  serverToRemove: Server,
): Server[] {
  const deletedKey = buildMcpServerConfigKey(serverToRemove);
  return currentServers.filter(
    (server) => buildMcpServerConfigKey(server) !== deletedKey,
  );
}

export function toggleThreadMcpServer<Server extends McpServerConfig>(
  currentServers: readonly Server[],
  serverToToggle: Server,
): Server[] {
  const selectedKey = buildMcpServerConfigKey(serverToToggle);
  const alreadyConnected = currentServers.some(
    (server) => buildMcpServerConfigKey(server) === selectedKey,
  );
  if (alreadyConnected) {
    return currentServers.filter(
      (server) => buildMcpServerConfigKey(server) !== selectedKey,
    );
  }

  return [...currentServers, serverToToggle];
}

export function reconcileThreadMcpServerProfile<
  Server extends McpServerConfig,
>(
  currentServers: readonly Server[],
  options: {
    previousServer: Server;
    nextServer: Server;
  },
): Server[] {
  const previousServerKey = buildMcpServerConfigKey(options.previousServer);
  const nextServerKey = buildMcpServerConfigKey(options.nextServer);
  const filteredServers = currentServers.filter(
    (server) => buildMcpServerConfigKey(server) !== previousServerKey,
  );
  if (filteredServers.length === currentServers.length) {
    return [...currentServers];
  }

  const nextIndex = filteredServers.findIndex(
    (server) => buildMcpServerConfigKey(server) === nextServerKey,
  );
  if (nextIndex >= 0) {
    return filteredServers.map((server, index) =>
      index === nextIndex
        ? {
            ...server,
            name: options.nextServer.name,
          }
        : server,
    );
  }

  return [...filteredServers, options.nextServer];
}
