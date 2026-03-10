import { describe, expect, it } from "vitest";
import {
  buildUpstreamErrorMessage,
  ChatCanceledError,
  isChatCanceledError,
  shouldRetryChatExecution,
} from "~/lib/server/usecase/chat/chat-execution-errors";

describe("isChatCanceledError", () => {
  it("accepts explicit chat cancellation errors", () => {
    expect(isChatCanceledError(new ChatCanceledError())).toBe(true);
  });

  it("accepts abort-like upstream errors", () => {
    expect(isChatCanceledError(new Error("Chat execution was canceled."))).toBe(
      true,
    );
  });
});

describe("buildUpstreamErrorMessage", () => {
  it("adds deployment guidance for missing resources", () => {
    expect(
      buildUpstreamErrorMessage(
        new Error("Resource not found"),
        "gpt-5-test",
      ),
    ).toContain("gpt-5-test");
  });
});

describe("shouldRetryChatExecution", () => {
  it("retries transient network termination errors before the final attempt", () => {
    const transientError = Object.assign(new Error("terminated"), {
      cause: { code: "UND_ERR_SOCKET" },
    });

    expect(shouldRetryChatExecution(transientError, 1, 2)).toBe(true);
    expect(shouldRetryChatExecution(transientError, 2, 2)).toBe(false);
  });
});
