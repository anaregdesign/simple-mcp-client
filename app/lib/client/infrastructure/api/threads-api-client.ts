import {
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/infrastructure/api/api-client";
import { readJsonPayload } from "~/lib/client/infrastructure/api/http";
import type {
  ThreadResource,
  ThreadWritePayload,
} from "~/lib/contracts/threads/types";

export type ThreadsApiResponse = {
  threads?: ThreadResource[];
  thread?: ThreadResource;
  authRequired?: boolean;
  error?: string;
};

type ThreadsApiClientOptions = {
  onAuthRequired?: () => void;
  fetchImpl?: typeof fetch;
};

const THREADS_AUTH_REQUIRED_MESSAGE =
  "Azure login is required. Open Settings and sign in to continue.";

export class ThreadsApiClient {
  async loadThreads(
    options: ThreadsApiClientOptions = {},
  ): Promise<ThreadsApiResponse> {
    const { payload } = await requestClientApi<ThreadsApiResponse>({
      url: "/api/threads",
      init: {
        method: "GET",
      },
      readPayload: (response) =>
        readJsonPayload<ThreadsApiResponse>(response, "Threads"),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to load threads.",
      authRequiredMessage:
        "Azure login is required. Open Settings and sign in to load threads.",
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    return payload;
  }

  async saveThread(
    payload: ThreadWritePayload,
    options: ThreadsApiClientOptions & {
      isUpdate?: boolean;
    } = {},
  ): Promise<ThreadsApiResponse> {
    const isUpdate = options.isUpdate === true;
    const { payload: responsePayload } =
      await requestClientApi<ThreadsApiResponse>({
        url: isUpdate
          ? `/api/threads/${encodeURIComponent(payload.id)}`
          : "/api/threads",
        init: {
          method: isUpdate ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        readPayload: (response) =>
          readJsonPayload<ThreadsApiResponse>(response, "Threads"),
        resolveAuthRequired: (status, responsePayloadValue) =>
          resolveAuthRequired(status, responsePayloadValue),
        readErrorMessage: (responsePayloadValue) =>
          typeof responsePayloadValue.error === "string"
            ? responsePayloadValue.error
            : null,
        fallbackErrorMessage: "Failed to save thread.",
        authRequiredMessage: THREADS_AUTH_REQUIRED_MESSAGE,
        onAuthRequired: options.onAuthRequired,
        fetchImpl: options.fetchImpl,
      });

    return responsePayload;
  }

  async deleteThread(
    threadId: string,
    options: ThreadsApiClientOptions = {},
  ): Promise<ThreadsApiResponse> {
    const { payload } = await requestClientApi<ThreadsApiResponse>({
      url: `/api/threads/${encodeURIComponent(threadId)}`,
      init: {
        method: "DELETE",
      },
      readPayload: (response) =>
        readJsonPayload<ThreadsApiResponse>(response, "Threads"),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to delete thread.",
      authRequiredMessage: THREADS_AUTH_REQUIRED_MESSAGE,
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    return payload;
  }

  async restoreThread(
    threadId: string,
    options: ThreadsApiClientOptions = {},
  ): Promise<ThreadsApiResponse> {
    const { payload } = await requestClientApi<ThreadsApiResponse>({
      url: `/api/threads/${encodeURIComponent(threadId)}`,
      init: {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          archived: false,
        }),
      },
      readPayload: (response) =>
        readJsonPayload<ThreadsApiResponse>(response, "Threads"),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to restore thread.",
      authRequiredMessage: THREADS_AUTH_REQUIRED_MESSAGE,
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    return payload;
  }
}

export const threadsApiClient = new ThreadsApiClient();
