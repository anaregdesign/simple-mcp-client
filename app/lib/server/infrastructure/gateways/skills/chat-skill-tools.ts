import type { ActiveSkillRuntimeEntry } from "~/lib/server/infrastructure/gateways/skills/chat-skill-runtime";
import {
  buildSkillResourceTools,
} from "~/lib/server/infrastructure/gateways/skills/chat-skill-resource-tools";
import {
  buildSkillScriptTools,
} from "~/lib/server/infrastructure/gateways/skills/chat-skill-script-tools";
import {
  createSkillToolRuntime,
  type SkillToolExecutionContext,
  type SkillToolLogHandlers,
} from "~/lib/server/infrastructure/gateways/skills/chat-skill-tool-runtime";
import type { Tool } from "@openai/agents";

export function buildSkillTools(
  activeSkills: ActiveSkillRuntimeEntry[],
  logHandlers: SkillToolLogHandlers,
  executionContext: SkillToolExecutionContext,
): Tool<unknown>[] {
  if (activeSkills.length === 0) {
    return [];
  }

  const runtime = createSkillToolRuntime(
    activeSkills,
    logHandlers,
    executionContext,
  );

  return [
    ...buildSkillResourceTools(runtime),
    ...buildSkillScriptTools(runtime),
  ];
}
