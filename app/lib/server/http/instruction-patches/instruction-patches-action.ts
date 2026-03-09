import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import {
  runInstructionEnhancement,
} from "~/lib/server/infrastructure/gateways/instruction-patches/instruction-enhancement-gateway";
import {
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  buildInstructionPatchUpstreamErrorPayload,
} from "~/lib/server/http/instruction-patches/instruction-patches-error";
import {
  isInstructionPromptSavePayload,
  parseInstructionReasoningEffort,
  readAzureConfig,
  readEnhanceAgentInstruction,
  readMessage,
  readSupportsReasoningEffort,
} from "~/lib/server/http/instruction-patches/instruction-patches-request";
import {
  errorResponse,
  invalidJsonResponse,
  methodNotAllowedResponse,
  readJsonPayload,
  validationErrorResponse,
} from "~/lib/server/http";
import {
  enhanceInstruction,
} from "~/lib/server/usecase/instruction-patches/instruction-patch-service";

const INSTRUCTION_PATCHES_ALLOWED_METHODS = ["POST"] as const;
const INSTRUCTION_PATCHES_ROUTE_PATH = "/api/instruction-patches";

export function handleInstructionPatchesLoader(): Response {
  return methodNotAllowedResponse(INSTRUCTION_PATCHES_ALLOWED_METHODS);
}

export async function handleInstructionPatchesAction(options: {
  request: Request;
}): Promise<Response> {
  const { request } = options;

  if (request.method !== "POST") {
    return methodNotAllowedResponse(INSTRUCTION_PATCHES_ALLOWED_METHODS);
  }

  const payloadResult = await readJsonPayload(request);
  if (!payloadResult.ok) {
    await logServerRouteEvent({
      request,
      route: INSTRUCTION_PATCHES_ROUTE_PATH,
      eventName: "invalid_json_body",
      action: "parse_request_body",
      level: "warning",
      statusCode: 400,
      message: "Invalid JSON body.",
    });

    return invalidJsonResponse();
  }

  const payload = payloadResult.value;

  if (isInstructionPromptSavePayload(payload)) {
    return validationErrorResponse(
      "invalid_instruction_patch_payload",
      "Instruction file save/load must be handled on the client side.",
    );
  }

  const message = readMessage(payload);
  if (!message) {
    await logServerRouteEvent({
      request,
      route: INSTRUCTION_PATCHES_ROUTE_PATH,
      eventName: "missing_message",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: "`message` is required.",
    });

    return validationErrorResponse("missing_message", "`message` is required.");
  }

  const enhanceAgentInstruction = readEnhanceAgentInstruction(payload);
  const supportsReasoningEffort = readSupportsReasoningEffort(payload);
  let reasoningEffort: ReasoningEffort | null = null;
  if (supportsReasoningEffort) {
    const reasoningEffortResult = parseInstructionReasoningEffort(payload);
    if (!reasoningEffortResult.ok) {
      await logServerRouteEvent({
        request,
        route: INSTRUCTION_PATCHES_ROUTE_PATH,
        eventName: "invalid_reasoning_effort",
        action: "validate_payload",
        level: "warning",
        statusCode: 422,
        message: reasoningEffortResult.error,
      });

      return validationErrorResponse(
        "invalid_reasoning_effort",
        reasoningEffortResult.error,
      );
    }
    reasoningEffort = reasoningEffortResult.value;
  }

  const azureConfigResult = readAzureConfig(payload);
  if (!azureConfigResult.ok) {
    await logServerRouteEvent({
      request,
      route: INSTRUCTION_PATCHES_ROUTE_PATH,
      eventName: "invalid_azure_config",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: azureConfigResult.error,
    });

    return validationErrorResponse(
      "invalid_azure_config",
      azureConfigResult.error,
    );
  }
  const azureConfig = azureConfigResult.value;

  if (!azureConfig.baseUrl) {
    return validationErrorResponse(
      "missing_azure_base_url",
      "Azure OpenAI base URL is missing.",
    );
  }
  if (!azureConfig.deploymentName) {
    return validationErrorResponse(
      "missing_azure_deployment_name",
      "Azure deployment name is missing.",
    );
  }
  if (azureConfig.apiVersion && azureConfig.apiVersion !== "v1") {
    return validationErrorResponse(
      "invalid_azure_api_version",
      "Azure OpenAI v1 endpoint requires `apiVersion` to be `v1`.",
    );
  }

  try {
    const patch = await enhanceInstruction(
      {
        message,
        enhanceAgentInstruction,
        azureConfig,
        reasoningEffort,
      },
      {
        runInstructionEnhancement,
      },
    );
    return Response.json({ message: patch });
  } catch (error) {
    const upstreamError = buildInstructionPatchUpstreamErrorPayload(
      error,
      azureConfig.deploymentName,
    );
    await logServerRouteEvent({
      request,
      route: INSTRUCTION_PATCHES_ROUTE_PATH,
      eventName: "enhance_instruction_failed",
      action: "enhance_instruction",
      statusCode: upstreamError.status,
      error,
      context: {
        projectName: azureConfig.projectName,
        deploymentName: azureConfig.deploymentName,
      },
    });

    return errorResponse({
      status: upstreamError.status,
      code: upstreamError.payload.code,
      error: upstreamError.payload.error,
      extras: upstreamError.payload.errorCode
        ? {
            errorCode: upstreamError.payload.errorCode,
          }
        : undefined,
    });
  }
}
