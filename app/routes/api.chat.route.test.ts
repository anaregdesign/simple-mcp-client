import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  installGlobalServerErrorLoggingMock,
  handleChatLoaderMock,
  handleChatActionMock,
} = vi.hoisted(() => ({
  installGlobalServerErrorLoggingMock: vi.fn(),
  handleChatLoaderMock: vi.fn(),
  handleChatActionMock: vi.fn(),
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

import { action, loader } from "./api.chat";

describe("/api/chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleChatLoaderMock.mockReturnValue(new Response(null, { status: 405 }));
    handleChatActionMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("delegates loader to the chat http handler", () => {
    const response = loader({} as never);

    expect(installGlobalServerErrorLoggingMock).toHaveBeenCalledTimes(1);
    expect(handleChatLoaderMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(405);
  });

  it("delegates action to the chat http handler", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
    });

    const response = await action({
      request,
    } as never);

    expect(installGlobalServerErrorLoggingMock).toHaveBeenCalledTimes(1);
    expect(handleChatActionMock).toHaveBeenCalledWith({
      request,
    });
    expect(response.status).toBe(200);
  });
});
