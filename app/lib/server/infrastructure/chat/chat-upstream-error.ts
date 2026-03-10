import {
  buildUpstreamErrorMessage,
  isChatCanceledError,
} from "~/lib/server/usecase/chat/chat-execution";

export type ChatUpstreamErrorPayload = {
  code: string;
  error: string;
  errorCode?: "azure_login_required";
};

export function buildChatUpstreamErrorPayload(
  error: unknown,
  deploymentName: string,
): {
  payload: ChatUpstreamErrorPayload;
  status: number;
} {
  if (isChatCanceledError(error)) {
    return {
      payload: {
        code: "request_canceled",
        error: "Chat execution was canceled by client disconnect.",
      },
      status: 499,
    };
  }

  if (isAzureCredentialError(error)) {
    return {
      payload: {
        code: "auth_required",
        error:
          'Azure authentication failed. Click "Azure Login", complete sign-in, and try again.',
        errorCode: "azure_login_required",
      },
      status: 401,
    };
  }

  return {
    payload: {
      code: "upstream_service_error",
      error: buildUpstreamErrorMessage(error, deploymentName),
    },
    status: 502,
  };
}

function isAzureCredentialError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return [
    "defaultazurecredential",
    "interactivebrowsercredential",
    "authenticationrequirederror",
    "automatic authentication has been disabled",
    "chainedtokencredential",
    "credentialunavailableerror",
    "managedidentitycredential",
    "azure credential failed",
    "azure credential returned tenant",
    "requested tenant",
    "token without tid claim",
  ].some((pattern) => message.includes(pattern));
}
