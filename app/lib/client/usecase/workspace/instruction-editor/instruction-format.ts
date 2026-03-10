import type { InstructionLanguage } from "~/lib/client/usecase/workspace/instruction-editor/view-types";
import {
  INSTRUCTION_ALLOWED_EXTENSIONS,
  INSTRUCTION_DEFAULT_EXTENSION,
} from "~/lib/constants/instruction";

type ValidationResult = { ok: true; value: true } | { ok: false; error: string };

export function resolveInstructionSourceFileName(loadedFileName: string | null): string | null {
  const loaded = (loadedFileName ?? "").trim();
  return loaded || null;
}

export function buildInstructionSuggestedFileName(
  sourceFileName: string | null,
  instruction: string,
): string {
  const resolvedExtension = resolveInstructionFormatExtension(sourceFileName, instruction);
  const normalizedSource = normalizeInstructionFileNameCandidate(sourceFileName);
  if (!normalizedSource) {
    return `instruction.${resolvedExtension}`;
  }

  const sourceExtension = getFileExtension(normalizedSource);
  if (INSTRUCTION_ALLOWED_EXTENSIONS.has(sourceExtension)) {
    return normalizedSource;
  }

  const stem = stripFileExtension(normalizedSource);
  return `${stem || "instruction"}.${resolvedExtension}`;
}

export function resolveInstructionFormatExtension(
  sourceFileName: string | null,
  instruction: string,
): string {
  const sourceExtension = getFileExtension(sourceFileName ?? "");
  if (INSTRUCTION_ALLOWED_EXTENSIONS.has(sourceExtension)) {
    return sourceExtension;
  }

  const trimmedInstruction = instruction.trim();
  if (!trimmedInstruction) {
    return INSTRUCTION_DEFAULT_EXTENSION;
  }

  if (
    (trimmedInstruction.startsWith("{") || trimmedInstruction.startsWith("[")) &&
    canParseJson(trimmedInstruction)
  ) {
    return "json";
  }

  if (looksLikeXmlDocument(trimmedInstruction)) {
    return "xml";
  }

  if (looksLikeMarkdownText(trimmedInstruction)) {
    return "md";
  }

  return INSTRUCTION_DEFAULT_EXTENSION;
}

export function detectInstructionLanguage(value: string): InstructionLanguage {
  const hasJapanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(value);
  const hasEnglish = /[A-Za-z]/.test(value);
  if (hasJapanese && hasEnglish) {
    return "mixed";
  }
  if (hasJapanese) {
    return "japanese";
  }
  if (hasEnglish) {
    return "english";
  }
  return "unknown";
}

export function buildInstructionEnhanceMessage(options: {
  instruction: string;
  extension: string;
  language: InstructionLanguage;
}): string {
  const languageLabel = describeInstructionLanguage(options.language);
  const normalizedExtension = options.extension.trim().toLowerCase() || "txt";
  const fileName = `instruction.${normalizedExtension}`;
  return [
    "<enhance_request>",
    "  <primary_objective>",
    "    Improve this instruction so the user's intent is realized precisely.",
    "    Remove contradictions, ambiguity, redundancy, and clear typos/spelling mistakes.",
    "  </primary_objective>",
    "  <editing_boundaries>",
    "    <rule>Preserve intended meaning, constraints, and safety boundaries.</rule>",
    "    <rule>Do not add new requirements not implied by the source.</rule>",
    "    <rule>Preserve original information as much as possible.</rule>",
    "    <rule>Remove details only when needed to resolve contradiction, ambiguity, or redundancy.</rule>",
    "    <rule>Do not omit, summarize, truncate, or replace content with placeholders.</rule>",
    "    <rule>Do not add placeholder comments/markers such as '省略', 'omitted', 'same as original', or equivalent.</rule>",
    "    <rule>Normalize and improve formatting for readability.</rule>",
    `    <rule>Preserve the original language (${languageLabel}).</rule>`,
    `    <rule>Preserve the original file format style for .${options.extension}.</rule>`,
    "  </editing_boundaries>",
    "  <diff_contract>",
    "    <rule>Use hunk lines with op values: context, add, remove.</rule>",
    "    <rule>Return hunks sorted by oldStart in strictly ascending order.</rule>",
    "    <rule>Do not return overlapping hunks or duplicate source ranges.</rule>",
    "    <rule>oldStart/newStart must match exact 1-based line numbers in the source text.</rule>",
    "    <rule>Context/remove line text must match the original lines exactly.</rule>",
    "    <rule>Include enough context lines around edits to anchor each hunk reliably.</rule>",
    `    <rule>Set fileName to ${fileName}.</rule>`,
    "  </diff_contract>",
    "  <output_contract>",
    "    <rule>Think step-by-step internally before responding, but do not reveal your reasoning.</rule>",
    "    <rule>Before output, verify objective completion, schema validity, and patch consistency.</rule>",
    "    <rule>If any internal check fails, return the requested fileName with an empty hunks array.</rule>",
    "    <rule>If no changes are needed, return an empty hunks array.</rule>",
    "    <rule>Return only schema-matching structured output. Do not return the full rewritten instruction.</rule>",
    "    <rule>Do not include markdown code fences or explanations.</rule>",
    "  </output_contract>",
    "  <instruction>",
    options.instruction,
    "  </instruction>",
    "</enhance_request>",
  ].join("\n");
}

export function validateEnhancedInstructionFormat(
  instruction: string,
  extension: string,
): ValidationResult {
  const normalizedExtension = extension.trim().toLowerCase();
  if (normalizedExtension === "json" && !canParseJson(instruction.trim())) {
    return {
      ok: false,
      error: "Enhanced instruction is not valid JSON. Please retry.",
    };
  }

  if (normalizedExtension === "xml" && !looksLikeXmlDocument(instruction.trim())) {
    return {
      ok: false,
      error: "Enhanced instruction is not valid XML-like content. Please retry.",
    };
  }

  return { ok: true, value: true };
}

export function describeInstructionLanguage(language: InstructionLanguage): string {
  if (language === "japanese") {
    return "Japanese";
  }
  if (language === "english") {
    return "English";
  }
  if (language === "mixed") {
    return "mixed language";
  }
  return "same language as source";
}

function normalizeInstructionFileNameCandidate(fileName: string | null): string {
  const candidate = (fileName ?? "").trim();
  if (!candidate) {
    return "";
  }

  const normalized = candidate.replace(/\\/g, "/");
  const lastSegment = normalized.slice(normalized.lastIndexOf("/") + 1);
  if (!lastSegment) {
    return "";
  }

  return lastSegment
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

function stripFileExtension(fileName: string): string {
  const extension = getFileExtension(fileName);
  if (!extension) {
    return fileName;
  }

  return fileName.slice(0, -(extension.length + 1));
}

function canParseJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function looksLikeXmlDocument(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith("<") || !trimmed.endsWith(">")) {
    return false;
  }

  if (/^<([A-Za-z_][A-Za-z0-9:_.-]*)(?:\s[^>]*)?\/>\s*$/.test(trimmed)) {
    return true;
  }

  const firstTag = trimmed.match(/^<([A-Za-z_][A-Za-z0-9:_.-]*)(?:\s[^>]*)?>/);
  if (!firstTag) {
    return false;
  }

  const rootTagName = firstTag[1];
  if (new RegExp(`<\\/${rootTagName}>\\s*$`).test(trimmed)) {
    return true;
  }

  return /\/>\s*$/.test(trimmed);
}

function looksLikeMarkdownText(value: string): boolean {
  if (/^(#{1,6})\s/m.test(value)) {
    return true;
  }
  if (/```/.test(value)) {
    return true;
  }
  return /^\s*[-*+]\s/m.test(value);
}

function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}
