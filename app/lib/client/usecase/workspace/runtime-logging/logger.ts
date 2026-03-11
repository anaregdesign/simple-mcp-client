import {
  reportClientEvent,
  reportClientError,
  reportClientWarning,
} from "~/lib/client/infrastructure/browser/runtime-event-log-client";

export type WorkspaceRuntimeLogReaders = {
  readActiveMainTab: () => string;
  readActiveThreadId: () => string;
  readSelectedPlaygroundAzureConnectionId: () => string;
  readSelectedPlaygroundAzureDeploymentName: () => string;
  readSelectedUtilityAzureConnectionId: () => string;
  readSelectedUtilityAzureDeploymentName: () => string;
  readActiveAzureTenantId: () => string;
  readActiveAzurePrincipalId: () => string;
};

type WorkspaceRuntimeLogContext = Record<string, unknown>;

type WorkspaceClientErrorOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: WorkspaceRuntimeLogContext;
};

type WorkspaceClientLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  context?: WorkspaceRuntimeLogContext;
};

export function createWorkspaceRuntimeLogging(
  readers: WorkspaceRuntimeLogReaders,
) {
  function buildRuntimeLogContext(
    extra: WorkspaceRuntimeLogContext = {},
  ): WorkspaceRuntimeLogContext {
    return {
      activeMainTab: readers.readActiveMainTab(),
      activeThreadId: readers.readActiveThreadId(),
      selectedPlaygroundAzureConnectionId:
        readers.readSelectedPlaygroundAzureConnectionId(),
      selectedPlaygroundAzureDeploymentName:
        readers.readSelectedPlaygroundAzureDeploymentName(),
      selectedUtilityAzureConnectionId:
        readers.readSelectedUtilityAzureConnectionId(),
      selectedUtilityAzureDeploymentName:
        readers.readSelectedUtilityAzureDeploymentName(),
      tenantId: readers.readActiveAzureTenantId(),
      principalId: readers.readActiveAzurePrincipalId(),
      ...extra,
    };
  }

  function logClientError(
    eventName: string,
    error: unknown,
    options: WorkspaceClientErrorOptions = {},
  ): void {
    const activeThreadId = readers.readActiveThreadId();

    reportClientError(eventName, error, {
      category: options.category ?? "frontend",
      location: options.location ?? "client.controller",
      action: options.action,
      ...(options.statusCode !== undefined
        ? { statusCode: options.statusCode }
        : {}),
      ...(activeThreadId ? { threadId: activeThreadId } : {}),
      context: buildRuntimeLogContext(options.context),
    });
  }

  function logClientWarning(
    eventName: string,
    message: string,
    options: WorkspaceClientLogOptions = {},
  ): void {
    const activeThreadId = readers.readActiveThreadId();

    reportClientWarning(eventName, message, {
      category: options.category ?? "frontend",
      location: options.location ?? "client.controller",
      action: options.action,
      ...(activeThreadId ? { threadId: activeThreadId } : {}),
      context: buildRuntimeLogContext(options.context),
    });
  }

  function logClientInfo(
    eventName: string,
    message: string,
    options: WorkspaceClientLogOptions = {},
  ): void {
    const activeThreadId = readers.readActiveThreadId();

    reportClientEvent({
      level: "info",
      category: options.category ?? "frontend",
      eventName,
      message,
      location: options.location ?? "client.controller",
      ...(options.action ? { action: options.action } : {}),
      ...(activeThreadId ? { threadId: activeThreadId } : {}),
      context: buildRuntimeLogContext(options.context),
    });
  }

  return {
    buildRuntimeLogContext,
    logClientError,
    logClientWarning,
    logClientInfo,
  };
}
