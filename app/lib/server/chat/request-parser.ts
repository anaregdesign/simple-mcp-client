/**
 * Server chat request parser module.
 */
import { normalizeAzureOpenAIBaseURL } from "~/lib/azure/dependencies";
import { CHAT_ATTACHMENT_ALLOWED_EXTENSIONS, CHAT_ATTACHMENT_MAX_FILES, CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH, CHAT_ATTACHMENT_MAX_NON_PDF_FILE_SIZE_BYTES, CHAT_ATTACHMENT_MAX_PDF_FILE_SIZE_BYTES, CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES, CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES, CHAT_MAX_AGENT_INSTRUCTION_LENGTH, CHAT_MAX_MCP_SERVERS, DEFAULT_AGENT_INSTRUCTION, HOME_REASONING_EFFORT_OPTIONS, TEMPERATURE_MAX, TEMPERATURE_MIN } from "~/lib/constants/chat";
import { AGENT_SKILL_NAME_MAX_LENGTH, CHAT_MAX_ACTIVE_SKILLS } from "~/lib/constants/skills";
import type { ReasoningEffort } from "~/lib/home/shared/view-types";
import type { ThreadSkillActivation } from "~/lib/home/skills/types";
import {
  parseThreadEnvironmentFromUnknown,
  type ThreadEnvironment,
} from "~/lib/home/thread/environment";
import {
  readThreadInstructionContextTogglesFromUnknown,
  type ThreadInstructionContextToggles,
} from "~/lib/home/thread/instruction-context";
import { parseChatMcpServerEntry } from "~/lib/mcp/server-config-parser";
import { buildMcpServerConfigKey } from "~/lib/mcp/config-key";

export type ThreadMessageRole = "user" | "assistant";

export type ClientAttachment = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

export type ClientMessage = {
  role: ThreadMessageRole;
  content: string;
  attachments: ClientAttachment[];
};

type ClientMcpHttpServerConfig = {
  name: string;
  transport: "streamable_http" | "sse";
  url: string;
  headers: Record<string, string>;
  useAzureAuth: boolean;
  azureAuthScope: string;
  timeoutSeconds: number;
};

type ClientMcpStdioServerConfig = {
  name: string;
  transport: "stdio";
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
};

export type ClientMcpServerConfig = ClientMcpHttpServerConfig | ClientMcpStdioServerConfig;
export type ClientSkillSelection = ThreadSkillActivation;

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type ResolvedAzureConfig = {
  tenantId: string;
  projectName: string;
  baseUrl: string;
  apiVersion: string;
  deploymentName: string;
};

export type ParsedChatRequest = {
  threadId: string | null;
  turnId: string | null;
  message: string;
  history: ClientMessage[];
  attachments: ClientAttachment[];
  reasoningEffort: ReasoningEffort | null;
  webSearchEnabled: boolean;
  temperature: number | null;
  agentInstruction: string;
  instructionContextToggles: ThreadInstructionContextToggles;
  threadEnvironment: ThreadEnvironment;
  skills: ClientSkillSelection[];
  explicitSkillLocations: string[];
  azureConfig: ResolvedAzureConfig;
  mcpServers: ClientMcpServerConfig[];
};

export type ChatRequestValidationErrorCode =
  | "invalid_json_body"
  | "missing_message"
  | "invalid_history_payload"
  | "invalid_attachments_payload"
  | "invalid_reasoning_effort_for_web_search"
  | "invalid_temperature_payload"
  | "invalid_instruction_context_toggles_payload"
  | "invalid_thread_environment_payload"
  | "invalid_skills_payload"
  | "invalid_explicit_skill_locations_payload"
  | "invalid_azure_config"
  | "invalid_reasoning_effort_for_deployment"
  | "invalid_mcp_servers_payload"
  | "missing_azure_base_url"
  | "missing_azure_deployment_name"
  | "invalid_azure_api_version";

export type ChatRequestValidationError = {
  code: ChatRequestValidationErrorCode;
  eventName: string;
  message: string;
  statusCode: 400 | 422;
};

export type ChatRequestParseResult =
  | { ok: true; value: ParsedChatRequest }
  | { ok: false; error: ChatRequestValidationError };

const MINIMAL_UNSUPPORTED_REASONING_DEPLOYMENT_PREFIXES = ["gpt-5.4"] as const;

export async function parseChatRequest(request: Request): Promise<ChatRequestParseResult> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid_json_body",
        eventName: "invalid_json_body",
        message: "Invalid JSON body.",
        statusCode: 400,
      },
    };
  }

  return parseChatRequestPayload(payload, { requestUrl: request.url });
}

export function parseChatRequestPayload(
  payload: unknown,
  options: {
    requestUrl?: string;
  } = {},
): ChatRequestParseResult {
  const message = readMessage(payload);
  if (!message) {
    return failure("missing_message", "`message` is required.");
  }

  const historyResult = readHistory(payload);
  if (!historyResult.ok) {
    return failure("invalid_history_payload", historyResult.error);
  }

  const attachmentsResult = readAttachments(payload);
  if (!attachmentsResult.ok) {
    return failure("invalid_attachments_payload", attachmentsResult.error);
  }

  const supportsReasoningEffort = readSupportsReasoningEffort(payload);
  const webSearchEnabled = readWebSearchEnabled(payload);
  const reasoningEffort = supportsReasoningEffort ? readReasoningEffort(payload) : null;
  if (
    reasoningEffort &&
    webSearchEnabled &&
    !isWebSearchCompatibleReasoningEffort(reasoningEffort)
  ) {
    return failure(
      "invalid_reasoning_effort_for_web_search",
      "`reasoningEffort` value is not compatible with `webSearchEnabled: true`.",
    );
  }

  const temperatureResult = readTemperature(payload);
  if (!temperatureResult.ok) {
    return failure("invalid_temperature_payload", temperatureResult.error);
  }

  const instructionContextTogglesResult = readInstructionContextToggles(payload);
  if (!instructionContextTogglesResult.ok) {
    return failure(
      "invalid_instruction_context_toggles_payload",
      instructionContextTogglesResult.error,
    );
  }

  const threadEnvironmentResult = readThreadEnvironment(payload);
  if (!threadEnvironmentResult.ok) {
    return failure("invalid_thread_environment_payload", threadEnvironmentResult.error);
  }

  const skillsResult = readSkills(payload);
  if (!skillsResult.ok) {
    return failure("invalid_skills_payload", skillsResult.error);
  }

  const explicitSkillLocationsResult = readExplicitSkillLocations(payload);
  if (!explicitSkillLocationsResult.ok) {
    return failure(
      "invalid_explicit_skill_locations_payload",
      explicitSkillLocationsResult.error,
    );
  }

  const azureConfigResult = readAzureConfig(payload);
  if (!azureConfigResult.ok) {
    return failure("invalid_azure_config", azureConfigResult.error);
  }
  const azureConfig = azureConfigResult.value;

  if (
    reasoningEffort &&
    !isDeploymentReasoningEffortCompatible(azureConfig.deploymentName, reasoningEffort)
  ) {
    return failure(
      "invalid_reasoning_effort_for_deployment",
      "`reasoningEffort` value is not supported by the selected deployment.",
    );
  }

  const mcpServersResult = readMcpServers(payload, { requestUrl: options.requestUrl });
  if (!mcpServersResult.ok) {
    return failure("invalid_mcp_servers_payload", mcpServersResult.error);
  }

  if (!azureConfig.baseUrl) {
    return failure("missing_azure_base_url", "Azure OpenAI base URL is missing.");
  }

  if (!azureConfig.deploymentName) {
    return failure("missing_azure_deployment_name", "Azure deployment name is missing.");
  }

  if (azureConfig.apiVersion && azureConfig.apiVersion !== "v1") {
    return failure(
      "invalid_azure_api_version",
      "Azure OpenAI v1 endpoint requires `apiVersion` to be `v1`.",
    );
  }

  return {
    ok: true,
    value: {
      threadId: readThreadId(payload),
      turnId: readTurnId(payload),
      message,
      history: historyResult.value,
      attachments: attachmentsResult.value,
      reasoningEffort,
      webSearchEnabled,
      temperature: temperatureResult.value,
      agentInstruction: readAgentInstruction(payload),
      instructionContextToggles: instructionContextTogglesResult.value,
      threadEnvironment: threadEnvironmentResult.value,
      skills: skillsResult.value,
      explicitSkillLocations: explicitSkillLocationsResult.value,
      azureConfig,
      mcpServers: mcpServersResult.value,
    },
  };
}

function failure(
  code: Exclude<ChatRequestValidationErrorCode, "invalid_json_body">,
  message: string,
): ChatRequestParseResult {
  return {
    ok: false,
    error: {
      code,
      eventName: code,
      message,
      statusCode: 422,
    },
  };
}

export function readThreadId(payload: unknown): string | null {
  return readOptionalPayloadLabel(payload, "threadId");
}

export function readTurnId(payload: unknown): string | null {
  return readOptionalPayloadLabel(payload, "turnId");
}

function readOptionalPayloadLabel(payload: unknown, key: string): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const value = payload[key];
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readMessage(payload: unknown): string {
  if (!isRecord(payload)) {
    return "";
  }

  const message = payload.message;
  if (typeof message !== "string") {
    return "";
  }

  return message.trim();
}

function readHistory(payload: unknown): ParseResult<ClientMessage[]> {
  if (!isRecord(payload) || !Array.isArray(payload.history)) {
    return { ok: true, value: [] };
  }

  const parsedHistory: ClientMessage[] = [];
  for (const [index, entry] of payload.history.entries()) {
    if (!isRecord(entry)) {
      continue;
    }

    const role = entry.role;
    const content = entry.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      continue;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      continue;
    }

    const attachmentsResult =
      role === "user"
        ? parseAttachmentList(entry.attachments, `history[${index}].attachments`)
        : { ok: true as const, value: [] as ClientAttachment[] };
    if (!attachmentsResult.ok) {
      return attachmentsResult;
    }

    parsedHistory.push({
      role,
      content: trimmedContent,
      attachments: attachmentsResult.value,
    });
  }

  return { ok: true, value: parsedHistory };
}

export function readAttachments(payload: unknown): ParseResult<ClientAttachment[]> {
  if (!isRecord(payload)) {
    return { ok: true, value: [] };
  }

  return parseAttachmentList(payload.attachments, "attachments");
}

function parseAttachmentList(rawValue: unknown, pathLabel: string): ParseResult<ClientAttachment[]> {
  if (rawValue === undefined || rawValue === null) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(rawValue)) {
    return { ok: false, error: `\`${pathLabel}\` must be an array.` };
  }

  if (rawValue.length > CHAT_ATTACHMENT_MAX_FILES) {
    return {
      ok: false,
      error: `You can attach up to ${CHAT_ATTACHMENT_MAX_FILES} files per message.`,
    };
  }

  const attachments: ClientAttachment[] = [];
  let totalSizeBytes = 0;
  let pdfTotalSizeBytes = 0;

  for (const [index, rawAttachment] of rawValue.entries()) {
    if (!isRecord(rawAttachment)) {
      return { ok: false, error: `\`${pathLabel}[${index}]\` is invalid.` };
    }

    const name = typeof rawAttachment.name === "string" ? rawAttachment.name.trim() : "";
    if (!name) {
      return { ok: false, error: `\`${pathLabel}[${index}].name\` is required.` };
    }

    if (name.length > CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH) {
      return {
        ok: false,
        error: `\`${pathLabel}[${index}].name\` must be ${CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH} characters or fewer.`,
      };
    }

    if (/[\r\n]/.test(name)) {
      return {
        ok: false,
        error: `\`${pathLabel}[${index}].name\` must not include line breaks.`,
      };
    }

    const extension = readFileExtension(name);
    if (!CHAT_ATTACHMENT_ALLOWED_EXTENSIONS.has(extension)) {
      return {
        ok: false,
        error: `\`${pathLabel}[${index}].name\` must use a supported extension (${Array.from(CHAT_ATTACHMENT_ALLOWED_EXTENSIONS, (entry) => `.${entry}`).join(", ")}).`,
      };
    }

    const dataUrlResult = parseAttachmentDataUrl(
      rawAttachment.dataUrl,
      `${pathLabel}[${index}].dataUrl`,
    );
    if (!dataUrlResult.ok) {
      return dataUrlResult;
    }

    const maxFileSizeBytes =
      extension === "pdf"
        ? CHAT_ATTACHMENT_MAX_PDF_FILE_SIZE_BYTES
        : CHAT_ATTACHMENT_MAX_NON_PDF_FILE_SIZE_BYTES;

    if (dataUrlResult.value.sizeBytes > maxFileSizeBytes) {
      return {
        ok: false,
        error: `\`${pathLabel}[${index}]\` exceeds max file size for .${extension} (${maxFileSizeBytes} bytes).`,
      };
    }

    if (rawAttachment.sizeBytes !== undefined) {
      if (
        typeof rawAttachment.sizeBytes !== "number" ||
        !Number.isSafeInteger(rawAttachment.sizeBytes) ||
        rawAttachment.sizeBytes < 0
      ) {
        return {
          ok: false,
          error: `\`${pathLabel}[${index}].sizeBytes\` must be a non-negative integer.`,
        };
      }

      if (rawAttachment.sizeBytes !== dataUrlResult.value.sizeBytes) {
        return {
          ok: false,
          error: `\`${pathLabel}[${index}].sizeBytes\` does not match file data size.`,
        };
      }
    }

    const rawMimeType = rawAttachment.mimeType;
    let mimeType = dataUrlResult.value.mimeType;
    if (rawMimeType !== undefined && rawMimeType !== null) {
      if (typeof rawMimeType !== "string") {
        return { ok: false, error: `\`${pathLabel}[${index}].mimeType\` must be a string.` };
      }

      const trimmed = rawMimeType.trim().toLowerCase();
      if (trimmed) {
        mimeType = trimmed;
      }
    }

    if (mimeType.length > 128 || /[\r\n]/.test(mimeType)) {
      return {
        ok: false,
        error: `\`${pathLabel}[${index}].mimeType\` is invalid.`,
      };
    }

    totalSizeBytes += dataUrlResult.value.sizeBytes;
    if (totalSizeBytes > CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES) {
      return {
        ok: false,
        error: `Total attachment size cannot exceed ${CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES} bytes.`,
      };
    }

    if (extension === "pdf") {
      pdfTotalSizeBytes += dataUrlResult.value.sizeBytes;
      if (pdfTotalSizeBytes > CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES) {
        return {
          ok: false,
          error: `Total PDF attachment size cannot exceed ${CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES} bytes.`,
        };
      }
    }

    attachments.push({
      name,
      mimeType,
      sizeBytes: dataUrlResult.value.sizeBytes,
      dataUrl: dataUrlResult.value.dataUrl,
    });
  }

  return { ok: true, value: attachments };
}

function parseAttachmentDataUrl(
  rawDataUrl: unknown,
  pathLabel: string,
): ParseResult<{
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
}> {
  if (typeof rawDataUrl !== "string") {
    return { ok: false, error: `\`${pathLabel}\` must be a string.` };
  }

  const dataUrl = rawDataUrl.trim();
  if (!dataUrl) {
    return { ok: false, error: `\`${pathLabel}\` is required.` };
  }

  const dataUrlMatch = /^data:([^,]*),([\s\S]*)$/i.exec(dataUrl);
  if (!dataUrlMatch) {
    return {
      ok: false,
      error: `\`${pathLabel}\` must be a valid data URL.`,
    };
  }

  const metadata = (dataUrlMatch[1] ?? "").trim();
  const payload = (dataUrlMatch[2] ?? "").trim();
  if (!payload) {
    return { ok: false, error: `\`${pathLabel}\` must include data.` };
  }

  const metadataParts = metadata
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const hasBase64 = metadataParts.some((part) => part.toLowerCase() === "base64");
  if (!hasBase64) {
    return {
      ok: false,
      error: `\`${pathLabel}\` must use base64 encoding.`,
    };
  }

  const normalizedBase64 = payload.replace(/\s+/g, "");
  if (
    normalizedBase64.length === 0 ||
    normalizedBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedBase64)
  ) {
    return {
      ok: false,
      error: `\`${pathLabel}\` contains invalid base64 data.`,
    };
  }

  const sizeBytes = Buffer.from(normalizedBase64, "base64").byteLength;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    return {
      ok: false,
      error: `\`${pathLabel}\` is empty.`,
    };
  }

  const rawMimeType = metadataParts[0]?.toLowerCase() ?? "";
  const mimeType = rawMimeType && rawMimeType !== "base64" ? rawMimeType : "";
  return {
    ok: true,
    value: {
      dataUrl,
      mimeType,
      sizeBytes,
    },
  };
}

function readFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function readReasoningEffort(payload: unknown): ReasoningEffort {
  if (!isRecord(payload)) {
    return "none";
  }

  const value = payload.reasoningEffort;
  if (
    typeof value === "string" &&
    HOME_REASONING_EFFORT_OPTIONS.includes(value as ReasoningEffort)
  ) {
    return value as ReasoningEffort;
  }

  return "none";
}

export function isWebSearchCompatibleReasoningEffort(reasoningEffort: ReasoningEffort): boolean {
  return reasoningEffort !== "minimal";
}

export function isDeploymentReasoningEffortCompatible(
  deploymentNameRaw: string,
  reasoningEffort: ReasoningEffort,
): boolean {
  const deploymentName = deploymentNameRaw.trim().toLowerCase();
  if (!deploymentName) {
    return true;
  }

  if (
    reasoningEffort === "minimal" &&
    MINIMAL_UNSUPPORTED_REASONING_DEPLOYMENT_PREFIXES.some((prefix) =>
      deploymentName.startsWith(prefix),
    )
  ) {
    return false;
  }

  return true;
}

function readSupportsReasoningEffort(payload: unknown): boolean {
  if (!isRecord(payload)) {
    return true;
  }

  return payload.supportsReasoningEffort !== false;
}

export function readWebSearchEnabled(payload: unknown): boolean {
  if (!isRecord(payload) || payload.webSearchEnabled === undefined) {
    return false;
  }

  return payload.webSearchEnabled === true;
}

export function readTemperature(payload: unknown): ParseResult<number | null> {
  if (!isRecord(payload) || payload.temperature === undefined || payload.temperature === null) {
    return { ok: true, value: null };
  }

  const value = payload.temperature;
  if (typeof value === "string" && value.trim() === "") {
    return { ok: true, value: null };
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return {
      ok: false,
      error: "`temperature` must be a number between 0 and 2, or omitted (None).",
    };
  }

  if (parsed < TEMPERATURE_MIN || parsed > TEMPERATURE_MAX) {
    return {
      ok: false,
      error: "`temperature` must be between 0 and 2, or omitted (None).",
    };
  }

  return { ok: true, value: parsed };
}

function readAgentInstruction(payload: unknown): string {
  if (!isRecord(payload)) {
    return DEFAULT_AGENT_INSTRUCTION;
  }

  const value = payload.agentInstruction;
  if (typeof value !== "string") {
    return DEFAULT_AGENT_INSTRUCTION;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_AGENT_INSTRUCTION;
  }

  return trimmed.slice(0, CHAT_MAX_AGENT_INSTRUCTION_LENGTH);
}

export function readInstructionContextToggles(
  payload: unknown,
): ParseResult<ThreadInstructionContextToggles> {
  if (!isRecord(payload)) {
    return { ok: false, error: "`instructionContextToggles` is required." };
  }

  if (!Object.prototype.hasOwnProperty.call(payload, "instructionContextToggles")) {
    return { ok: false, error: "`instructionContextToggles` is required." };
  }

  const parsed = readThreadInstructionContextTogglesFromUnknown(
    payload.instructionContextToggles,
  );
  if (!parsed) {
    return {
      ok: false,
      error:
        "`instructionContextToggles` must include all known boolean keys (for example `{ \"system\": true }`).",
    };
  }

  return { ok: true, value: parsed };
}

export function readThreadEnvironment(payload: unknown): ParseResult<ThreadEnvironment> {
  if (!isRecord(payload)) {
    return { ok: true, value: {} };
  }

  const parsed = parseThreadEnvironmentFromUnknown(payload.threadEnvironment, {
    strict: true,
    pathLabel: "threadEnvironment",
  });
  if (!parsed.ok) {
    return parsed;
  }

  return { ok: true, value: parsed.value };
}

export function readSkills(payload: unknown): ParseResult<ClientSkillSelection[]> {
  if (!isRecord(payload) || payload.skills === undefined) {
    return { ok: true, value: [] };
  }

  const value = payload.skills;
  if (!Array.isArray(value)) {
    return { ok: false, error: "`skills` must be an array." };
  }

  if (value.length > CHAT_MAX_ACTIVE_SKILLS) {
    return {
      ok: false,
      error: `You can enable up to ${CHAT_MAX_ACTIVE_SKILLS} Skills per message.`,
    };
  }

  const result: ClientSkillSelection[] = [];
  const seenLocations = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      return { ok: false, error: `skills[${index}] is invalid.` };
    }

    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const location = typeof entry.location === "string" ? entry.location.trim() : "";
    if (!name) {
      return { ok: false, error: `skills[${index}].name is required.` };
    }

    if (name.length > AGENT_SKILL_NAME_MAX_LENGTH) {
      return {
        ok: false,
        error: `skills[${index}].name must be ${AGENT_SKILL_NAME_MAX_LENGTH} characters or fewer.`,
      };
    }

    if (!location) {
      return { ok: false, error: `skills[${index}].location is required.` };
    }

    if (location.length > 4096) {
      return { ok: false, error: `skills[${index}].location is too long.` };
    }

    if (seenLocations.has(location)) {
      continue;
    }

    seenLocations.add(location);
    result.push({
      name,
      location,
    });
  }

  return { ok: true, value: result };
}

export function readExplicitSkillLocations(payload: unknown): ParseResult<string[]> {
  if (!isRecord(payload) || payload.explicitSkillLocations === undefined) {
    return { ok: true, value: [] };
  }

  const value = payload.explicitSkillLocations;
  if (!Array.isArray(value)) {
    return { ok: false, error: "`explicitSkillLocations` must be an array." };
  }

  if (value.length > CHAT_MAX_ACTIVE_SKILLS) {
    return {
      ok: false,
      error: `You can specify up to ${CHAT_MAX_ACTIVE_SKILLS} explicit Skill locations per message.`,
    };
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string") {
      return {
        ok: false,
        error: `explicitSkillLocations[${index}] must be a string.`,
      };
    }

    const location = entry.trim();
    if (!location) {
      return {
        ok: false,
        error: `explicitSkillLocations[${index}] is required.`,
      };
    }

    if (location.length > 4096) {
      return {
        ok: false,
        error: `explicitSkillLocations[${index}] is too long.`,
      };
    }

    if (seen.has(location)) {
      continue;
    }

    seen.add(location);
    result.push(location);
  }

  return { ok: true, value: result };
}

function readAzureConfig(payload: unknown): ParseResult<ResolvedAzureConfig> {
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

  if (value.projectName !== undefined && typeof value.projectName !== "string") {
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

  if (value.deploymentName !== undefined && typeof value.deploymentName !== "string") {
    return { ok: false, error: "`azureConfig.deploymentName` must be a string." };
  }

  const tenantId = typeof value.tenantId === "string" ? value.tenantId.trim() : "";
  const baseUrl =
    typeof value.baseUrl === "string" ? normalizeAzureOpenAIBaseURL(value.baseUrl) : "";
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
      projectName: typeof value.projectName === "string" ? value.projectName.trim() : "",
      baseUrl,
      apiVersion,
      deploymentName,
    },
  };
}

export function readMcpServers(
  payload: unknown,
  options: {
    requestUrl?: string;
  } = {},
): ParseResult<ClientMcpServerConfig[]> {
  if (!isRecord(payload)) {
    return { ok: true, value: [] };
  }

  const value = payload.mcpServers;
  if (value === undefined) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(value)) {
    return { ok: false, error: "`mcpServers` must be an array." };
  }

  if (value.length > CHAT_MAX_MCP_SERVERS) {
    return { ok: false, error: `You can add up to ${CHAT_MAX_MCP_SERVERS} MCP servers.` };
  }

  const result: ClientMcpServerConfig[] = [];
  const dedupeKeys = new Set<string>();

  for (const [index, entry] of value.entries()) {
    const parsedConfigResult = parseChatMcpServerEntry(entry, {
      index,
      requestUrl: options.requestUrl,
    });
    if (!parsedConfigResult.ok) {
      return parsedConfigResult;
    }
    if (!parsedConfigResult.value) {
      continue;
    }

    const config = parsedConfigResult.value;

    const dedupeKey = buildMcpServerConfigKey(config);
    if (dedupeKeys.has(dedupeKey)) {
      continue;
    }

    dedupeKeys.add(dedupeKey);
    result.push(config);
  }

  return { ok: true, value: result };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
