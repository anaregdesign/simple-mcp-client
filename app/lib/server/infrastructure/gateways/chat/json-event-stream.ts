/**
 * Server runtime module.
 */
export function createJsonEventStreamResponse(
  run: (context: { send: (payload: unknown) => void; signal: AbortSignal }) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let isCanceled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        if (isCanceled || abortController.signal.aborted) {
          return;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        await run({
          send,
          signal: abortController.signal,
        });
      } finally {
        if (!isCanceled) {
          controller.close();
        }
      }
    },
    cancel() {
      isCanceled = true;
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
