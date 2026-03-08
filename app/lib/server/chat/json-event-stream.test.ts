/**
 * Test module verifying JSON event stream helper.
 */
import { describe, expect, it } from "vitest";
import { createJsonEventStreamResponse } from "~/lib/server/chat/json-event-stream";

describe("createJsonEventStreamResponse", () => {
  it("returns SSE headers and streamed JSON payload blocks", async () => {
    const response = createJsonEventStreamResponse(async ({ send }) => {
      send({ type: "progress", message: "Preparing request..." });
      send({ type: "final", message: "Done" });
    });

    expect(response.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(response.headers.get("Connection")).toBe("keep-alive");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");

    const body = await response.text();
    expect(body).toContain('data: {"type":"progress","message":"Preparing request..."}');
    expect(body).toContain('data: {"type":"final","message":"Done"}');
  });

  it("aborts runner signal when stream reader cancels", async () => {
    let abortObserved = false;
    const response = createJsonEventStreamResponse(async ({ send, signal }) => {
      send({ type: "progress", message: "Preparing request..." });
      await new Promise<void>((resolve) => {
        signal.addEventListener(
          "abort",
          () => {
            abortObserved = true;
            resolve();
          },
          { once: true },
        );
      });
    });

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();
    if (!reader) {
      return;
    }

    await reader.cancel();
    expect(abortObserved).toBe(true);
  });
});
