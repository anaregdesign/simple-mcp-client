import { Agent, run, user } from "@openai/agents";
import { INSTRUCTION_DIFF_PATCH_OUTPUT_TYPE } from "~/lib/constants/instruction";
import {
  createAzureResponsesModel,
} from "~/lib/server/infrastructure/gateways/azure/azure-openai-gateway";
import type {
  InstructionEnhanceOptions,
} from "~/lib/server/usecase/instruction-patches/instruction-patch-service";

export async function runInstructionEnhancement(
  options: InstructionEnhanceOptions,
): Promise<unknown> {
  const model = createAzureResponsesModel({
    baseUrl: options.azureConfig.baseUrl,
    tenantId: options.azureConfig.tenantId,
    deploymentName: options.azureConfig.deploymentName,
  });

  const agent = new Agent({
    name: "LocalPlaygroundInstructionAgent",
    instructions: options.enhanceAgentInstruction,
    model,
    modelSettings: {
      ...(options.reasoningEffort
        ? { reasoning: { effort: options.reasoningEffort } }
        : {}),
    },
    outputType: INSTRUCTION_DIFF_PATCH_OUTPUT_TYPE,
  });

  const result = await run(agent, [user(options.message)]);
  return result.finalOutput;
}
