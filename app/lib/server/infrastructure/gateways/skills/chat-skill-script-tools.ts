import { tool, type Tool } from "@openai/agents";
import {
  parseThreadEnvironmentFromUnknown,
  THREAD_ENVIRONMENT_KEY_MAX_LENGTH,
  THREAD_ENVIRONMENT_KEY_PATTERN,
  THREAD_ENVIRONMENT_VALUE_MAX_LENGTH,
  THREAD_ENVIRONMENT_VARIABLES_MAX,
} from "~/lib/domain/value-objects/thread-environment";
import { AGENT_SKILL_SCRIPT_OUTPUT_MAX_CHARS } from "~/lib/constants/skills";
import { runSkillScript } from "~/lib/server/infrastructure/gateways/skills/skill-runtime";
import { applySkillScriptEnvironmentChanges } from "~/lib/server/usecase/chat/skill-script-environment";
import type { SkillToolRuntime } from "~/lib/server/infrastructure/gateways/skills/chat-skill-tool-runtime";

export function buildSkillScriptTools(
  runtime: SkillToolRuntime,
): Tool<unknown>[] {
  const runScriptTool = tool({
    name: "skill_run_script",
    description:
      "Run executable files from a Skill scripts directory. Use only when the Skill instructions require script execution.",
    parameters: {
      type: "object" as const,
      properties: {
        skill: { type: "string" as const, description: "Optional active Skill name or location. Required when multiple Skills are active." },
        path: { type: "string" as const, description: "Relative script path inside the selected Skill's scripts directory." },
        args: {
          type: "array" as const,
          description: "Optional script arguments.",
          items: { type: "string" as const },
        },
        timeoutMs: { type: "integer" as const, minimum: 1, description: "Optional script timeout in milliseconds." },
      },
      required: ["path"],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      runtime.executeWithSkillOperationLog("skill_run_script", input, async () => {
        if (!runtime.isRecord(input)) {
          return runtime.buildSkillToolErrorResult("Invalid tool input.");
        }

        const skillSelection = runtime.resolveSkillSelection(input.skill, {
          allowAllWhenMissing: false,
        });
        if (!skillSelection.ok) {
          return runtime.buildSkillToolErrorResult(skillSelection.error);
        }
        const selectedSkill = skillSelection.skills[0];

        const relativePath = runtime.readTrimmedString(input.path);
        if (!relativePath) {
          return runtime.buildSkillToolErrorResult("path is required.");
        }

        const argsResult = runtime.readSkillScriptArgs(input.args);
        if (!argsResult.ok) {
          return runtime.buildSkillToolErrorResult(argsResult.error);
        }

        const timeoutMs = runtime.normalizeSkillScriptTimeout(input.timeoutMs);
        try {
          const scriptEnvironment = runtime.buildSkillScriptEnvironment(
            runtime.threadEnvironment,
          );
          const result = await runSkillScript({
            skillRoot: selectedSkill.skillRoot,
            relativePath,
            args: argsResult.value,
            env: scriptEnvironment,
            timeoutMs,
            outputMaxChars: AGENT_SKILL_SCRIPT_OUTPUT_MAX_CHARS,
          });
          const environmentChanges = applySkillScriptEnvironmentChanges(
            runtime.threadEnvironment,
            result.environmentChanges,
          );

          if (result.exitCode !== 0) {
            return runtime.buildSkillToolResult({
              ok: false,
              error: runtime.buildSkillScriptRunFailureMessage(result),
              skill: selectedSkill.name,
              location: selectedSkill.location,
              path: relativePath,
              ...result,
              environmentChanges,
              threadEnvironment: runtime.readCurrentThreadEnvironment(),
            });
          }

          return runtime.buildSkillToolResult({
            ok: true,
            skill: selectedSkill.name,
            location: selectedSkill.location,
            path: relativePath,
            ...result,
            environmentChanges,
            threadEnvironment: runtime.readCurrentThreadEnvironment(),
          });
        } catch (error) {
          return runtime.buildSkillToolErrorResult(
            runtime.readErrorMessage(error),
          );
        }
      }),
  });

  const getEnvironmentTool = tool({
    name: "skill_get_environment",
    description:
      "Read thread-scoped environment variables shared across turns.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      runtime.executeWithSkillOperationLog("skill_get_environment", input, () =>
        runtime.buildSkillToolResult({
          ok: true,
          threadEnvironment: runtime.readCurrentThreadEnvironment(),
        }),
      ),
  });

  const setEnvironmentTool = tool({
    name: "skill_set_environment",
    description:
      "Update thread-scoped environment variables shared across turns. Supports ${VAR} expansion with current environment values.",
    parameters: {
      type: "object" as const,
      properties: {
        variables: {
          type: "object" as const,
          description: `Optional environment key-value map. Keys must match ${THREAD_ENVIRONMENT_KEY_PATTERN.toString()} and be ${THREAD_ENVIRONMENT_KEY_MAX_LENGTH} characters or fewer.`,
          additionalProperties: { type: "string" as const },
        },
        unset: {
          type: "array" as const,
          description: "Optional list of environment variable names to remove.",
          items: { type: "string" as const },
        },
      },
      required: [],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      runtime.executeWithSkillOperationLog("skill_set_environment", input, () => {
        if (!runtime.isRecord(input)) {
          return runtime.buildSkillToolErrorResult("Invalid tool input.");
        }

        const variablesResult = parseThreadEnvironmentFromUnknown(
          input.variables,
          {
            strict: true,
            pathLabel: "variables",
          },
        );
        if (!variablesResult.ok) {
          return runtime.buildSkillToolErrorResult(variablesResult.error);
        }

        const unsetResult = runtime.readUnsetThreadEnvironmentKeys(input.unset);
        if (!unsetResult.ok) {
          return runtime.buildSkillToolErrorResult(unsetResult.error);
        }

        const nextKeys = new Set(Object.keys(runtime.threadEnvironment));
        for (const key of Object.keys(variablesResult.value)) {
          nextKeys.add(key);
        }
        for (const key of unsetResult.value) {
          nextKeys.delete(key);
        }
        if (nextKeys.size > THREAD_ENVIRONMENT_VARIABLES_MAX) {
          return runtime.buildSkillToolErrorResult(
            `threadEnvironment can include up to ${THREAD_ENVIRONMENT_VARIABLES_MAX} entries.`,
          );
        }

        const updatedKeys: string[] = [];
        for (const [key, value] of Object.entries(variablesResult.value)) {
          const expanded = runtime.expandThreadEnvironmentTemplate(
            value,
            runtime.threadEnvironment,
          );
          if (expanded.length > THREAD_ENVIRONMENT_VALUE_MAX_LENGTH) {
            return runtime.buildSkillToolErrorResult(
              `variables["${key}"] exceeds ${THREAD_ENVIRONMENT_VALUE_MAX_LENGTH} characters after expansion.`,
            );
          }
          runtime.threadEnvironment[key] = expanded;
          updatedKeys.push(key);
        }

        const removedKeys: string[] = [];
        for (const key of unsetResult.value) {
          if (!(key in runtime.threadEnvironment)) {
            continue;
          }

          delete runtime.threadEnvironment[key];
          removedKeys.push(key);
        }

        return runtime.buildSkillToolResult({
          ok: true,
          updatedKeys,
          removedKeys,
          threadEnvironment: runtime.readCurrentThreadEnvironment(),
        });
      }),
  });

  return [runScriptTool, getEnvironmentTool, setEnvironmentTool];
}
