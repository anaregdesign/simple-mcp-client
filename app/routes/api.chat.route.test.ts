import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  installGlobalServerErrorLoggingMock,
  handleChatLoaderMock,
  handleChatActionMock,
  readAuthenticatedWorkspaceUserMock,
} = vi.hoisted(() => ({
  installGlobalServerErrorLoggingMock: vi.fn(),
  handleChatLoaderMock: vi.fn(),
  handleChatActionMock: vi.fn(),
  readAuthenticatedWorkspaceUserMock: vi.fn(),
}));

vi.mock(
  "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway",
  () => ({
    installGlobalServerErrorLogging: installGlobalServerErrorLoggingMock,
  }),
);

vi.mock("~/lib/server/infrastructure/chat/chat-action", () => ({
  handleChatLoader: handleChatLoaderMock,
  handleChatAction: handleChatActionMock,
}));

vi.mock("~/lib/server/infrastructure/auth/read-authenticated-user", () => ({
  readAuthenticatedWorkspaceUser: readAuthenticatedWorkspaceUserMock,
}));

import { action, loader } from "./api.chat";

describe("/api/chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleChatLoaderMock.mockReturnValue(new Response(null, { status: 405 }));
    handleChatActionMock.mockResolvedValue(new Response(null, { status: 200 }));
    readAuthenticatedWorkspaceUserMock.mockResolvedValue({
      id: 10,
      tenantId: "tenant-a",
      principalId: "principal-a",
    });
  });

  it("delegates loader to the chat http handler", () => {
    const response = loader({} as never);

    expect(installGlobalServerErrorLoggingMock).toHaveBeenCalledTimes(1);
    expect(handleChatLoaderMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(405);
  });

  it("returns 401 when auth is unavailable", async () => {
    readAuthenticatedWorkspaceUserMock.mockResolvedValueOnce(null);
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
    });

    const response = await action({
      request,
    } as never);

    expect(installGlobalServerErrorLoggingMock).toHaveBeenCalledTimes(1);
    expect(handleChatActionMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "auth_required",
      error: "Azure login is required. Click Azure Login to continue.",
      authRequired: true,
    });
  });

  it("delegates action to the chat http handler with the authenticated user", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
    });

    const response = await action({
      request,
    } as never);

    expect(installGlobalServerErrorLoggingMock).toHaveBeenCalledTimes(1);
    expect(handleChatActionMock).toHaveBeenCalledWith({
      request,
      user: {
        id: 10,
        tenantId: "tenant-a",
        principalId: "principal-a",
      },
    });
    expect(response.status).toBe(200);
  });
});
