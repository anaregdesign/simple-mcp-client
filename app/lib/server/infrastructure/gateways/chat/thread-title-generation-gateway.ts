import { Agent, run, user } from "@openai/agents";
import type {
  ThreadTitleGenerationGateway,
  ThreadTitleGenerationRequest,
} from "~/lib/domain/repositories/thread-title-generation-gateway";
import { createAzureResponsesModel } from "~/lib/server/infrastructure/gateways/azure/azure-openai-gateway";

export function createThreadTitleGenerationGateway(): ThreadTitleGenerationGateway {
  return {
    async generateTitle(request: ThreadTitleGenerationRequest): Promise<unknown> {
      const agent = new Agent({
        name: "LocalPlaygroundThreadTitleAgent",
        instructions: request.systemPrompt,
        model: createAzureResponsesModel({
          baseUrl: request.baseUrl,
          tenantId: request.tenantId,
          deploymentName: request.deploymentName,
        }),
        modelSettings: {
          ...(request.reasoningEffort
            ? { reasoning: { effort: request.reasoningEffort } }
            : {}),
        },
      });

      const result = await run(agent, [user(request.prompt)]);
      return result.finalOutput;
    },
  };
}
