import { tool, type Tool } from "@openai/agents";
import { clipTextForSkillTool } from "~/lib/server/usecase/chat/skill-tool-text";
import { readSkillMarkdown } from "~/lib/server/infrastructure/gateways/skills/skill-catalog";
import {
  readSkillResourceBuffer,
  readSkillResourceText,
} from "~/lib/server/infrastructure/gateways/skills/skill-runtime";
import type { SkillToolRuntime } from "~/lib/server/infrastructure/gateways/skills/chat-skill-tool-runtime";

export function buildSkillResourceTools(
  runtime: SkillToolRuntime,
): Tool<unknown>[] {
  const listResourcesTool = tool({
    name: "skill_list_resources",
    description:
      "List scripts, references, and assets available in active Skills. Use this before reading files or running scripts.",
    parameters: {
      type: "object" as const,
      properties: {
        skill: {
          type: "string" as const,
          description:
            "Optional active Skill name or location. If omitted, resources from all active Skills are listed.",
        },
        category: {
          type: "string" as const,
          enum: ["scripts", "references", "assets"],
          description: "Optional resource category filter.",
        },
      },
      required: [],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      runtime.executeWithSkillOperationLog("skill_list_resources", input, () => {
        if (!runtime.isRecord(input)) {
          return runtime.buildSkillToolErrorResult("Invalid tool input.");
        }

        const selectedCategory = runtime.readSkillToolCategory(input.category);
        if (input.category !== undefined && !selectedCategory) {
          return runtime.buildSkillToolErrorResult(
            "category must be one of scripts, references, or assets.",
          );
        }

        const skillSelection = runtime.resolveSkillSelection(input.skill, {
          allowAllWhenMissing: true,
        });
        if (!skillSelection.ok) {
          return runtime.buildSkillToolErrorResult(skillSelection.error);
        }

        return runtime.buildSkillToolResult({
          ok: true,
          skills: skillSelection.skills.map((skill) =>
            runtime.buildSkillResourcePreview(skill, selectedCategory),
          ),
        });
      }),
  });

  const readGuideTool = tool({
    name: "skill_read_guide",
    description:
      "Read the full SKILL.md instructions for an active Skill. Use this only when frontmatter is insufficient for the current task.",
    parameters: {
      type: "object" as const,
      properties: {
        skill: { type: "string" as const, description: "Optional active Skill name or location. Required when multiple Skills are active." },
        startLine: { type: "integer" as const, minimum: 1, description: "Optional 1-based start line." },
        endLine: { type: "integer" as const, minimum: 1, description: "Optional 1-based end line." },
        maxChars: { type: "integer" as const, minimum: 1, description: "Optional max character length for returned text." },
      },
      required: [],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      runtime.executeWithSkillOperationLog("skill_read_guide", input, async () => {
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

        let content: string;
        try {
          content = await readSkillMarkdown(selectedSkill.location);
        } catch (error) {
          return runtime.buildSkillToolErrorResult(
            runtime.readErrorMessage(error),
          );
        }

        const startLine = runtime.readInteger(input.startLine);
        const endLine = runtime.readInteger(input.endLine);
        if (
          (startLine !== null && startLine <= 0) ||
          (endLine !== null && endLine <= 0)
        ) {
          return runtime.buildSkillToolErrorResult(
            "startLine and endLine must be positive integers.",
          );
        }
        if (startLine !== null && endLine !== null && endLine < startLine) {
          return runtime.buildSkillToolErrorResult(
            "endLine must be greater than or equal to startLine.",
          );
        }

        const maxChars = runtime.normalizeSkillReadMaxChars(input.maxChars);
        const lines = content.replace(/\r\n?/g, "\n").split("\n");
        const begin = Math.max(1, startLine ?? 1);
        const end = Math.min(lines.length, endLine ?? lines.length);
        const lineWindowText =
          lines.length === 0 || end < begin
            ? ""
            : lines.slice(begin - 1, end).join("\n");
        const clipped = clipTextForSkillTool(lineWindowText, maxChars);

        return runtime.buildSkillToolResult({
          ok: true,
          skill: selectedSkill.name,
          location: selectedSkill.location,
          path: "SKILL.md",
          startLine: begin,
          endLine: end,
          totalLines: lines.length,
          truncated: clipped.truncated,
          text: clipped.value,
        });
      }),
  });

  const readReferenceTool = tool({
    name: "skill_read_reference",
    description:
      "Read text files from Skill references directories. Use this to load policies, docs, and checklists.",
    parameters: {
      type: "object" as const,
      properties: {
        skill: { type: "string" as const, description: "Optional active Skill name or location. Required when multiple Skills are active." },
        path: { type: "string" as const, description: "Relative file path inside the selected Skill's references directory." },
        startLine: { type: "integer" as const, minimum: 1, description: "Optional 1-based start line." },
        endLine: { type: "integer" as const, minimum: 1, description: "Optional 1-based end line." },
        maxChars: { type: "integer" as const, minimum: 1, description: "Optional max character length for returned text." },
      },
      required: ["path"],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      runtime.executeWithSkillOperationLog("skill_read_reference", input, async () => {
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

        let content: string;
        try {
          content = await readSkillResourceText({
            skillRoot: selectedSkill.skillRoot,
            kind: "references",
            relativePath,
          });
        } catch (error) {
          return runtime.buildSkillToolErrorResult(
            runtime.readErrorMessage(error),
          );
        }

        const startLine = runtime.readInteger(input.startLine);
        const endLine = runtime.readInteger(input.endLine);
        if (
          (startLine !== null && startLine <= 0) ||
          (endLine !== null && endLine <= 0)
        ) {
          return runtime.buildSkillToolErrorResult(
            "startLine and endLine must be positive integers.",
          );
        }
        if (startLine !== null && endLine !== null && endLine < startLine) {
          return runtime.buildSkillToolErrorResult(
            "endLine must be greater than or equal to startLine.",
          );
        }

        const maxChars = runtime.normalizeSkillReadMaxChars(input.maxChars);
        const lines = content.replace(/\r\n?/g, "\n").split("\n");
        const begin = Math.max(1, startLine ?? 1);
        const end = Math.min(lines.length, endLine ?? lines.length);
        const lineWindowText =
          lines.length === 0 || end < begin
            ? ""
            : lines.slice(begin - 1, end).join("\n");
        const clipped = clipTextForSkillTool(lineWindowText, maxChars);

        return runtime.buildSkillToolResult({
          ok: true,
          skill: selectedSkill.name,
          location: selectedSkill.location,
          path: relativePath,
          startLine: begin,
          endLine: end,
          totalLines: lines.length,
          truncated: clipped.truncated,
          text: clipped.value,
        });
      }),
  });

  const readAssetTool = tool({
    name: "skill_read_asset",
    description:
      "Read files from Skill assets directories. Use encoding=text for UTF-8 assets or encoding=base64 for binary payloads.",
    parameters: {
      type: "object" as const,
      properties: {
        skill: { type: "string" as const, description: "Optional active Skill name or location. Required when multiple Skills are active." },
        path: { type: "string" as const, description: "Relative file path inside the selected Skill's assets directory." },
        encoding: { type: "string" as const, enum: ["text", "base64"], description: "Return encoding for asset content." },
        maxChars: { type: "integer" as const, minimum: 1, description: "Optional max character length for returned content." },
      },
      required: ["path"],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      runtime.executeWithSkillOperationLog("skill_read_asset", input, async () => {
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

        const encoding = runtime.readTrimmedString(input.encoding) || "text";
        if (encoding !== "text" && encoding !== "base64") {
          return runtime.buildSkillToolErrorResult(
            "encoding must be text or base64.",
          );
        }

        let buffer: Buffer;
        try {
          buffer = await readSkillResourceBuffer({
            skillRoot: selectedSkill.skillRoot,
            kind: "assets",
            relativePath,
          });
        } catch (error) {
          return runtime.buildSkillToolErrorResult(
            runtime.readErrorMessage(error),
          );
        }

        const maxChars = runtime.normalizeSkillReadMaxChars(input.maxChars);
        const payload =
          encoding === "base64"
            ? buffer.toString("base64")
            : buffer.toString("utf8");
        const clipped = clipTextForSkillTool(payload, maxChars);

        return runtime.buildSkillToolResult({
          ok: true,
          skill: selectedSkill.name,
          location: selectedSkill.location,
          path: relativePath,
          encoding,
          sizeBytes: buffer.byteLength,
          truncated: clipped.truncated,
          content: clipped.value,
        });
      }),
  });

  return [
    listResourcesTool,
    readGuideTool,
    readReferenceTool,
    readAssetTool,
  ];
}
