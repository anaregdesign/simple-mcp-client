import {
  CHAT_MAX_AGENT_INSTRUCTION_LENGTH,
  REASONING_EFFORT_OPTIONS,
} from "~/lib/constants/chat";
import {
  INSTRUCTION_ENHANCE_SYSTEM_PROMPT,
  PROMPT_ALLOWED_FILE_EXTENSIONS,
  PROMPT_DEFAULT_FILE_EXTENSION,
  PROMPT_DEFAULT_FILE_STEM,
  PROMPT_MAX_CONTENT_BYTES,
  PROMPT_MAX_FILE_NAME_LENGTH,
  PROMPT_MAX_FILE_STEM_LENGTH,
} from "~/lib/constants/instruction";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import {
  type InstructionPatchAzureConfig,
} from "~/lib/server/usecase/instruction-patches/instruction-patch-service";
import { normalizeAzureOpenAIBaseURL } from "~/lib/server/usecase/azure/azure-openai-url";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function readMessage(payload: unknown): string {
  if (!isRecord(payload)) {
    return "";
  }
  const message = payload.message;
  if (typeof message !== "string") {
    return "";
  }
  return message.trim();
}

export function readEnhanceAgentInstruction(payload: unknown): string {
  if (!isRecord(payload)) {
    return INSTRUCTION_ENHANCE_SYSTEM_PROMPT;
  }

  const value = payload.enhanceAgentInstruction;
  if (typeof value !== "string") {
    return INSTRUCTION_ENHANCE_SYSTEM_PROMPT;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return INSTRUCTION_ENHANCE_SYSTEM_PROMPT;
  }

  return trimmed.slice(0, CHAT_MAX_AGENT_INSTRUCTION_LENGTH);
}

export function parseInstructionReasoningEffort(
  payload: unknown,
): ParseResult<ReasoningEffort> {
  if (!isRecord(payload)) {
    return { ok: true, value: "high" };
  }

  const value = payload.reasoningEffort;
  if (value === undefined || value === null) {
    return { ok: true, value: "high" };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "`reasoningEffort` must be a string." };
  }

  const normalized = value.trim();
  if (REASONING_EFFORT_OPTIONS.includes(normalized as ReasoningEffort)) {
    return { ok: true, value: normalized as ReasoningEffort };
  }

  return {
    ok: false,
    error: `\`reasoningEffort\` must be one of: ${REASONING_EFFORT_OPTIONS.join(", ")}.`,
  };
}

export function readSupportsReasoningEffort(payload: unknown): boolean {
  if (!isRecord(payload)) {
    return true;
  }

  return payload.supportsReasoningEffort !== false;
}

export function readAzureConfig(
  payload: unknown,
): ParseResult<InstructionPatchAzureConfig> {
  if (!isRecord(payload)) {
    return { ok: false, error: "`azureConfig` is required." };
  }

  const value = payload.azureConfig;
  if (value === undefined || value === null) {
    return { ok: false, error: "`azureConfig` is required." };
  }

  if (!isRecord(value)) {
    return { ok: false, error: "`azureConfig` must be an object." };
  }

  if (
    value.projectName !== undefined &&
    typeof value.projectName !== "string"
  ) {
    return { ok: false, error: "`azureConfig.projectName` must be a string." };
  }

  if (value.tenantId !== undefined && typeof value.tenantId !== "string") {
    return { ok: false, error: "`azureConfig.tenantId` must be a string." };
  }

  if (value.baseUrl !== undefined && typeof value.baseUrl !== "string") {
    return { ok: false, error: "`azureConfig.baseUrl` must be a string." };
  }

  if (value.apiVersion !== undefined && typeof value.apiVersion !== "string") {
    return { ok: false, error: "`azureConfig.apiVersion` must be a string." };
  }

  if (
    value.deploymentName !== undefined &&
    typeof value.deploymentName !== "string"
  ) {
    return {
      ok: false,
      error: "`azureConfig.deploymentName` must be a string.",
    };
  }

  const tenantId =
    typeof value.tenantId === "string" ? value.tenantId.trim() : "";
  const baseUrl =
    typeof value.baseUrl === "string"
      ? normalizeAzureOpenAIBaseURL(value.baseUrl)
      : "";
  const apiVersion =
    typeof value.apiVersion === "string" && value.apiVersion.trim()
      ? value.apiVersion.trim()
      : "v1";
  const deploymentName =
    typeof value.deploymentName === "string" ? value.deploymentName.trim() : "";

  if (!tenantId) {
    return { ok: false, error: "`azureConfig.tenantId` is required." };
  }

  if (!baseUrl) {
    return { ok: false, error: "`azureConfig.baseUrl` is required." };
  }

  if (!deploymentName) {
    return { ok: false, error: "`azureConfig.deploymentName` is required." };
  }

  return {
    ok: true,
    value: {
      tenantId,
      projectName:
        typeof value.projectName === "string" ? value.projectName.trim() : "",
      baseUrl,
      apiVersion,
      deploymentName,
    },
  };
}

export function isInstructionPromptSavePayload(payload: unknown): boolean {
  return isRecord(payload) && typeof payload.instruction === "string";
}

export function parseInstructionContent(payload: unknown): ParseResult<string> {
  if (!isRecord(payload)) {
    return { ok: false, error: "Invalid instruction payload." };
  }

  if (typeof payload.instruction !== "string") {
    return { ok: false, error: "`instruction` must be a string." };
  }

  const instruction = payload.instruction;
  if (!instruction.trim()) {
    return { ok: false, error: "Instruction is empty." };
  }

  const byteLength = Buffer.byteLength(instruction, "utf8");
  if (byteLength > PROMPT_MAX_CONTENT_BYTES) {
    return {
      ok: false,
      error: `Instruction is too large. Max ${PROMPT_MAX_CONTENT_BYTES} bytes.`,
    };
  }

  return { ok: true, value: instruction };
}

export function parseRequestedPromptFileName(
  payload: unknown,
): ParseResult<string | null> {
  if (!isRecord(payload)) {
    return { ok: true, value: null };
  }

  const rawFileName = payload.fileName;
  if (rawFileName === undefined || rawFileName === null) {
    return { ok: true, value: null };
  }

  if (typeof rawFileName !== "string") {
    return { ok: false, error: "`fileName` must be a string." };
  }

  const trimmed = rawFileName.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }

  return normalizeRequestedPromptFileName(trimmed);
}

export function normalizeRequestedPromptFileName(
  fileName: string,
): ParseResult<string> {
  const baseName = getBaseName(fileName.trim());
  if (!baseName) {
    return { ok: false, error: "File name is invalid." };
  }

  const extension = getFileExtension(baseName);
  if (extension && !PROMPT_ALLOWED_FILE_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      error: "File extension must be .md, .txt, .xml, or .json.",
    };
  }

  const stemCandidate = extension
    ? baseName.slice(0, -extension.length)
    : baseName;
  const normalizedStem = normalizeFileStem(stemCandidate);
  if (!normalizedStem) {
    return { ok: false, error: "File name is invalid." };
  }

  const normalizedExtension = extension || PROMPT_DEFAULT_FILE_EXTENSION;
  const normalizedFileName = `${normalizedStem}${normalizedExtension}`;
  if (normalizedFileName.length > PROMPT_MAX_FILE_NAME_LENGTH) {
    return {
      ok: false,
      error: `File name must be ${PROMPT_MAX_FILE_NAME_LENGTH} characters or fewer.`,
    };
  }

  return { ok: true, value: normalizedFileName };
}

export function buildPromptFileName(
  sourceFileName: string | null,
  options: {
    now?: Date;
    randomSuffix?: string;
  } = {},
): string {
  const now = options.now ?? new Date();
  const randomSuffix = normalizeRandomSuffix(options.randomSuffix);

  const { stem, extension } = parseSourceFileName(sourceFileName);
  const timestamp = formatTimestamp(now);
  return `${stem}-${timestamp}-${randomSuffix}${extension}`;
}

function parseSourceFileName(sourceFileName: string | null): {
  stem: string;
  extension: string;
} {
  const candidate = (sourceFileName ?? "").trim();
  if (!candidate) {
    return {
      stem: PROMPT_DEFAULT_FILE_STEM,
      extension: PROMPT_DEFAULT_FILE_EXTENSION,
    };
  }

  const baseName = getBaseName(candidate);
  const extension = getFileExtension(baseName);
  const normalizedExtension = PROMPT_ALLOWED_FILE_EXTENSIONS.has(extension)
    ? extension
    : PROMPT_DEFAULT_FILE_EXTENSION;
  const fileStem = extension ? baseName.slice(0, -extension.length) : baseName;
  const normalizedStem = normalizeFileStem(fileStem);

  return {
    stem: normalizedStem || PROMPT_DEFAULT_FILE_STEM,
    extension: normalizedExtension,
  };
}

function normalizeFileStem(rawStem: string): string {
  const normalized = rawStem
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  if (!normalized) {
    return "";
  }

  return normalized.slice(0, PROMPT_MAX_FILE_STEM_LENGTH);
}

function normalizeRandomSuffix(source: string | undefined): string {
  const candidate =
    typeof source === "string"
      ? source
      : Math.random().toString(36).slice(2, 8);
  const normalized = candidate
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8);
  return normalized || "prompt";
}

function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function getBaseName(pathValue: string): string {
  const normalized = pathValue.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return "";
  }
  return fileName.slice(lastDot).toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
