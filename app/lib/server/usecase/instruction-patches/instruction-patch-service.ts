import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import {
  INSTRUCTION_DIFF_PATCH_FILE_NAME_PATTERN,
  INSTRUCTION_DIFF_PATCH_MAX_HUNKS,
  INSTRUCTION_DIFF_PATCH_MAX_HUNK_LINES,
  INSTRUCTION_DIFF_PATCH_MAX_LINE_TEXT_LENGTH,
} from "~/lib/constants/instruction";

export type InstructionPatchAzureConfig = {
  tenantId: string;
  projectName: string;
  baseUrl: string;
  apiVersion: string;
  deploymentName: string;
};

export type InstructionEnhanceOptions = {
  message: string;
  enhanceAgentInstruction: string;
  azureConfig: InstructionPatchAzureConfig;
  reasoningEffort: ReasoningEffort | null;
};

type InstructionDiffPatchLineOutput = {
  op: "context" | "add" | "remove";
  text: string;
};

type InstructionDiffPatchHunkOutput = {
  oldStart: number;
  newStart: number;
  lines: InstructionDiffPatchLineOutput[];
};

type InstructionDiffPatchOutput = {
  fileName: string;
  hunks: InstructionDiffPatchHunkOutput[];
};

export async function enhanceInstruction(
  options: InstructionEnhanceOptions,
  dependencies: {
    runInstructionEnhancement: (
      options: InstructionEnhanceOptions,
    ) => Promise<unknown>;
  },
): Promise<string> {
  const finalOutput = await dependencies.runInstructionEnhancement(options);
  return extractInstructionDiffPatch(finalOutput);
}

export function extractInstructionDiffPatch(finalOutput: unknown): string {
  if (isRecord(finalOutput)) {
    const output = readInstructionDiffPatchOutput(finalOutput);
    if (output) {
      return buildInstructionDiffPatchText(output);
    }
  }

  if (typeof finalOutput === "string") {
    const trimmed = finalOutput.trim();
    if (!trimmed) {
      throw new Error("Enhancement response is empty.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("Enhancement response is not valid JSON.");
    }

    const output = readInstructionDiffPatchOutput(parsed);
    if (output) {
      return buildInstructionDiffPatchText(output);
    }
  }

  throw new Error(
    "Enhancement response does not match the required patch schema.",
  );
}

function buildInstructionDiffPatchText(
  output: InstructionDiffPatchOutput,
): string {
  if (output.hunks.length === 0) {
    return "";
  }

  const fileName = normalizeInstructionPatchFileName(output.fileName);
  const patchLines: string[] = [`--- a/${fileName}`, `+++ b/${fileName}`];

  for (const hunk of output.hunks) {
    let oldLength = 0;
    let newLength = 0;
    const hunkLines: string[] = [];

    for (const line of hunk.lines) {
      if (line.op === "context") {
        oldLength += 1;
        newLength += 1;
        hunkLines.push(` ${line.text}`);
        continue;
      }

      if (line.op === "remove") {
        oldLength += 1;
        hunkLines.push(`-${line.text}`);
        continue;
      }

      newLength += 1;
      hunkLines.push(`+${line.text}`);
    }

    patchLines.push(
      `@@ -${hunk.oldStart},${oldLength} +${hunk.newStart},${newLength} @@`,
    );
    patchLines.push(...hunkLines);
  }

  return patchLines.join("\n");
}

function normalizeInstructionPatchFileName(value: string): string {
  const normalizedSlashes = value.trim().replace(/\\/g, "/");
  const fileName = normalizedSlashes.slice(
    normalizedSlashes.lastIndexOf("/") + 1,
  );
  const safeFileName = fileName
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return safeFileName || "instruction.txt";
}

function readInstructionDiffPatchOutput(
  value: unknown,
): InstructionDiffPatchOutput | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.fileName !== "string" || !Array.isArray(value.hunks)) {
    return null;
  }

  if (
    !INSTRUCTION_DIFF_PATCH_FILE_NAME_PATTERN.test(value.fileName) ||
    value.fileName.length > 128 ||
    value.hunks.length > INSTRUCTION_DIFF_PATCH_MAX_HUNKS
  ) {
    return null;
  }

  const hunks: InstructionDiffPatchHunkOutput[] = [];
  for (const hunk of value.hunks) {
    if (!isRecord(hunk) || !Array.isArray(hunk.lines)) {
      return null;
    }

    if (
      hunk.lines.length === 0 ||
      hunk.lines.length > INSTRUCTION_DIFF_PATCH_MAX_HUNK_LINES
    ) {
      return null;
    }

    const oldStart = hunk.oldStart;
    const newStart = hunk.newStart;
    if (
      typeof oldStart !== "number" ||
      !Number.isSafeInteger(oldStart) ||
      oldStart < 0 ||
      typeof newStart !== "number" ||
      !Number.isSafeInteger(newStart) ||
      newStart < 0
    ) {
      return null;
    }

    const lines: InstructionDiffPatchLineOutput[] = [];
    for (const line of hunk.lines) {
      if (
        !isRecord(line) ||
        typeof line.text !== "string" ||
        line.text.length > INSTRUCTION_DIFF_PATCH_MAX_LINE_TEXT_LENGTH
      ) {
        return null;
      }

      const op = line.op;
      if (op !== "context" && op !== "add" && op !== "remove") {
        return null;
      }

      lines.push({
        op,
        text: line.text,
      });
    }

    hunks.push({
      oldStart,
      newStart,
      lines,
    });
  }

  return {
    fileName: value.fileName,
    hunks,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
