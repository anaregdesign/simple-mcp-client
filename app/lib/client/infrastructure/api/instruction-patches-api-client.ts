import {
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/infrastructure/api/api-client";
import { readJsonPayload } from "~/lib/client/infrastructure/api/http";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

export type InstructionPatchAzureConfigInput = {
  tenantId: string;
  projectName: string;
  baseUrl: string;
  apiVersion: string;
  deploymentName: string;
};

export type InstructionPatchEnhancementRequest = {
  message: string;
  azureConfig: InstructionPatchAzureConfigInput;
  supportsReasoningEffort: boolean;
  reasoningEffort?: ReasoningEffort;
  enhanceAgentInstruction: string;
};

export type InstructionPatchesApiResponse = {
  message?: string;
  error?: string;
  errorCode?: "azure_login_required";
  authRequired?: boolean;
};

type InstructionPatchesApiClientOptions = {
  onAuthRequired?: () => void;
  fetchImpl?: typeof fetch;
};

export class InstructionPatchesApiClient {
  async enhanceInstruction(
    request: InstructionPatchEnhancementRequest,
    options: InstructionPatchesApiClientOptions = {},
  ): Promise<InstructionPatchesApiResponse> {
    const { payload } = await requestClientApi<InstructionPatchesApiResponse>({
      url: "/api/instruction-patches",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
      },
      readPayload: (response) =>
        readJsonPayload<InstructionPatchesApiResponse>(
          response,
          "Instruction patches",
        ),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to enhance instruction.",
      authRequiredMessage:
        "Azure login is required. Open Settings and sign in to enhance instructions.",
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    return payload;
  }
}

export const instructionPatchesApiClient = new InstructionPatchesApiClient();
