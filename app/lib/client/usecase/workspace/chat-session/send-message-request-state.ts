import type {
  ThreadRequestState,
} from "~/lib/client/usecase/workspace/threads/thread-request-state";

export function applySendResult(
  current: ThreadRequestState,
  options:
    | {
        status: "optimistic";
        turnId: string;
      }
    | {
        status: "succeeded";
      }
    | {
        status: "canceled";
      }
    | {
        status: "failed";
        turnId: string;
        error: unknown;
      },
): ThreadRequestState {
  if (options.status === "optimistic") {
    return {
      ...current,
      isSending: true,
      sendProgressMessages: ["Preparing request..."],
      activeTurnId: options.turnId,
      lastErrorTurnId: null,
      error: null,
    };
  }

  if (options.status === "succeeded" || options.status === "canceled") {
    return {
      ...current,
      isSending: false,
      sendProgressMessages: [],
      activeTurnId: null,
      lastErrorTurnId: null,
      error: null,
    };
  }

  return {
    ...current,
    isSending: false,
    sendProgressMessages: [],
    activeTurnId: null,
    lastErrorTurnId: options.turnId,
    error: mapSendError(options.error),
  };
}

function mapSendError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Could not reach the server.";
}
