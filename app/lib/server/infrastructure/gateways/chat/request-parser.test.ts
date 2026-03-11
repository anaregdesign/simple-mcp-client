/**
 * Test module verifying thin chat request parser behavior.
 */
import { describe, expect, it } from "vitest";
import {
  parseChatRequest,
  parseChatRequestPayload,
  type ParsedChatRequest,
} from "~/lib/server/infrastructure/gateways/chat/request-parser";

function expectParsed(
  result: ReturnType<typeof parseChatRequestPayload>,
): ParsedChatRequest {
  if (!result.ok) {
    throw new Error(
      `Expected success but got ${result.error.code}: ${result.error.message}`,
    );
  }

  return result.value;
}

describe("parseChatRequest", () => {
  it("returns invalid_json_body for malformed JSON", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{ invalid-json",
    });

    const result = await parseChatRequest(request);
    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_json_body",
        eventName: "invalid_json_body",
        message: "Invalid JSON body.",
        statusCode: 400,
      },
    });
  });
});

describe("parseChatRequestPayload", () => {
  it("parses a valid payload", () => {
    const parsed = expectParsed(
      parseChatRequestPayload({
        threadId: "thread-1",
        turnId: "turn-1",
      }),
    );

    expect(parsed).toEqual({
      threadId: "thread-1",
      turnId: "turn-1",
    });
  });

  it("fails when threadId is missing", () => {
    const result = parseChatRequestPayload({
      turnId: "turn-1",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_thread_id",
        eventName: "invalid_thread_id",
        message: "`threadId` is required.",
        statusCode: 422,
      },
    });
  });

  it("fails when turnId is missing", () => {
    const result = parseChatRequestPayload({
      threadId: "thread-1",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_turn_id",
        eventName: "invalid_turn_id",
        message: "`turnId` is required.",
        statusCode: 422,
      },
    });
  });
});
