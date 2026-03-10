import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/client/infrastructure/browser/runtime-event-log-client", () => ({
  reportClientEvent: vi.fn(),
  reportClientError: vi.fn(),
  reportClientWarning: vi.fn(),
}));

import {
  reportClientEvent,
  reportClientError,
  reportClientWarning,
} from "~/lib/client/infrastructure/browser/runtime-event-log-client";
import {
  createWorkspaceRuntimeLogging,
} from "~/lib/client/usecase/workspace/workspace-runtime-logging";

function createLogger() {
  return createWorkspaceRuntimeLogging({
    readActiveMainTab: () => "skills",
    readActiveThreadId: () => "thread-1",
    readSelectedPlaygroundAzureConnectionId: () => "project-1",
    readSelectedPlaygroundAzureDeploymentName: () => "gpt-5",
    readSelectedUtilityAzureConnectionId: () => "utility-project-1",
    readSelectedUtilityAzureDeploymentName: () => "utility-gpt-5",
    readActiveAzureTenantId: () => "tenant-1",
    readActiveAzurePrincipalId: () => "principal-1",
  });
}

describe("createWorkspaceRuntimeLogging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges workspace context into error reports", () => {
    const logger = createLogger();
    const error = new Error("boom");

    logger.logClientError("thread_save_failed", error, {
      statusCode: 500,
      context: {
        source: "autosave",
      },
    });

    expect(reportClientError).toHaveBeenCalledWith(
      "thread_save_failed",
      error,
      expect.objectContaining({
        category: "frontend",
        location: "client.controller",
        statusCode: 500,
        threadId: "thread-1",
        context: {
          activeMainTab: "skills",
          activeThreadId: "thread-1",
          selectedPlaygroundAzureConnectionId: "project-1",
          selectedPlaygroundAzureDeploymentName: "gpt-5",
          selectedUtilityAzureConnectionId: "utility-project-1",
          selectedUtilityAzureDeploymentName: "utility-gpt-5",
          tenantId: "tenant-1",
          principalId: "principal-1",
          source: "autosave",
        },
      }),
    );
  });

  it("reports warnings and info events with the current thread context", () => {
    const logger = createLogger();

    logger.logClientWarning("skills_reload_warning", "warning message");
    logger.logClientInfo("skills_reload_started", "info message", {
      action: "reload",
    });

    expect(reportClientWarning).toHaveBeenCalledWith(
      "skills_reload_warning",
      "warning message",
      expect.objectContaining({
        category: "frontend",
        location: "client.controller",
        threadId: "thread-1",
      }),
    );

    expect(reportClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "info",
        category: "frontend",
        eventName: "skills_reload_started",
        message: "info message",
        location: "client.controller",
        action: "reload",
        threadId: "thread-1",
      }),
    );
  });
});
