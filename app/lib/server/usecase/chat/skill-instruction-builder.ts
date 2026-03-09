import {
  DEFAULT_AGENT_INSTRUCTION,
} from "~/lib/constants/chat";
import { AGENT_SKILL_PROMPT_RESOURCE_PREVIEW_MAX_FILES } from "~/lib/constants/skills";
import type { ThreadInstructionContextToggles } from "~/lib/domain/entities/thread-record";
import type {
  ActiveSkillRuntimeEntry,
} from "~/lib/server/usecase/chat/skill-runtime-types";
import type { InstructionSystemContextPayload } from "~/lib/server/usecase/chat/chat-execution";

export function buildAgentInstructionWithSkills(
  baseInstruction: string,
  runtime: {
    activeSkills: ActiveSkillRuntimeEntry[];
  },
  options: {
    instructionContextToggles: ThreadInstructionContextToggles;
    systemInstructionContext: InstructionSystemContextPayload | null;
  },
): string {
  const normalizedBaseInstruction =
    baseInstruction.trim() || DEFAULT_AGENT_INSTRUCTION;
  const lines: string[] = [normalizedBaseInstruction];

  if (
    options.instructionContextToggles.system &&
    options.systemInstructionContext
  ) {
    lines.push(
      "",
      "<implicit_instruction_contexts>",
      "The following context is injected by Local Playground at runtime.",
      "Treat these identifiers and runtime values as authoritative. Reuse values directly and do not guess missing values.",
      '<context name="system">',
      "```json",
      JSON.stringify(options.systemInstructionContext, null, 2),
      "```",
      "</context>",
      "</implicit_instruction_contexts>",
    );
  }

  if (runtime.activeSkills.length === 0) {
    return lines.join("\n");
  }

  const preloadedGuideSkillCount = runtime.activeSkills.filter(
    (skill) => skill.preloadedGuideMarkdown !== null,
  ).length;
  lines.push(
    "",
    "<skills_context>",
    "The runtime supports agentskills-compatible Skill directories (SKILL.md + scripts/references/assets). Some skills may also define non-standard directories like resources/.",
    preloadedGuideSkillCount > 0
      ? "Linked Skills in this turn are initialized in order with skill/activate then skill_read_guide before model execution."
      : "Active skills are preloaded with frontmatter only (name + description).",
    "skill_read_guide is already executed once for linked Skills. Call it again only when a specific line range is needed.",
    "Use skill_list_resources before reading/running files when paths are unknown.",
    "Use skill_get_environment and skill_set_environment to inspect and update thread-scoped environment variables that persist across turns.",
    "skill_run_script runs with the current thread-scoped environment variables.",
    "Follow each SKILL.md guide and use the needed paths from skill_list_resources with skill_read_guide, skill_read_reference, skill_read_asset, and skill_run_script.",
  );

  if (
    preloadedGuideSkillCount > 0 &&
    preloadedGuideSkillCount < runtime.activeSkills.length
  ) {
    lines.push(
      "Other active skills are preloaded with frontmatter only (name + description).",
    );
  }
  lines.push("<active_skills>");
  for (const skill of runtime.activeSkills) {
    lines.push(
      `<<<ACTIVE_SKILL_FRONTMATTER name="${skill.name}" location="${skill.location}">>>`,
    );
    lines.push(`description: ${truncateSkillDescription(skill.description)}`);
    lines.push("<<<END_ACTIVE_SKILL_FRONTMATTER>>>");
    if (skill.preloadedGuideMarkdown !== null) {
      lines.push(
        `<<<ACTIVE_SKILL_GUIDE name="${skill.name}" location="${skill.location}">>>`,
      );
      lines.push(skill.preloadedGuideMarkdown);
      lines.push("<<<END_ACTIVE_SKILL_GUIDE>>>");
    }
    lines.push(
      ...buildSkillPromptResourcePreview({
        heading: "scripts",
        files: skill.scripts,
        truncated: skill.scriptsTruncated,
      }),
    );
    lines.push(
      ...buildSkillPromptResourcePreview({
        heading: "references",
        files: skill.references,
        truncated: skill.referencesTruncated,
      }),
    );
    lines.push(
      ...buildSkillPromptResourcePreview({
        heading: "assets",
        files: skill.assets,
        truncated: skill.assetsTruncated,
      }),
    );
  }
  lines.push("</active_skills>");
  lines.push(
    "Follow active skills as additional instructions. If skills conflict, the most specific active skill should win unless it violates system safety.",
  );

  lines.push("</skills_context>");
  return lines.join("\n");
}

function truncateSkillDescription(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= 220) {
    return normalized;
  }

  return `${normalized.slice(0, 217)}...`;
}

function buildSkillPromptResourcePreview(options: {
  heading: "scripts" | "references" | "assets";
  files: ActiveSkillRuntimeEntry["scripts"];
  truncated: boolean;
}): string[] {
  const lines: string[] = [`<${options.heading}>`];
  if (options.files.length === 0) {
    lines.push("- (none)");
    lines.push(`</${options.heading}>`);
    return lines;
  }

  const previewFiles = options.files.slice(
    0,
    AGENT_SKILL_PROMPT_RESOURCE_PREVIEW_MAX_FILES,
  );
  for (const entry of previewFiles) {
    lines.push(`- ${entry.path} (${entry.sizeBytes} bytes)`);
  }
  if (options.truncated || options.files.length > previewFiles.length) {
    const omitted = options.truncated
      ? Math.max(1, options.files.length - previewFiles.length)
      : Math.max(0, options.files.length - previewFiles.length);
    lines.push(`- ...and ${omitted} more files.`);
  }
  lines.push(`</${options.heading}>`);
  return lines;
}
