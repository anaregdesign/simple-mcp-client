/**
 * Server chat request parser module.
 */
import { normalizeAzureOpenAIBaseURL } from "~/lib/azure/dependencies";
import {
  AGENT_SKILL_NAME_MAX_LENGTH,
  CHAT_ATTACHMENT_ALLOWED_EXTENSIONS,
  CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH,
  CHAT_ATTACHMENT_MAX_FILES,
  CHAT_ATTACHMENT_MAX_NON_PDF_FILE_SIZE_BYTES,
  CHAT_ATTACHMENT_MAX_PDF_FILE_SIZE_BYTES,
  CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES,
  CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES,
  CHAT_MAX_ACTIVE_SKILLS,
  CHAT_MAX_AGENT_INSTRUCTION_LENGTH,
  CHAT_MAX_MCP_SERVERS,
  DEFAULT_AGENT_INSTRUCTION,
  ENV_KEY_PATTERN,
  HOME_REASONING_EFFORT_OPTIONS,
  MCP_AZURE_AUTH_SCOPE_MAX_LENGTH,
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
  MCP_HTTP_HEADERS_MAX,
  MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
  MCP_SERVER_NAME_MAX_LENGTH,
  MCP_STDIO_ARGS_MAX,
  MCP_STDIO_ENV_VARS_MAX,
  MCP_TIMEOUT_SECONDS_MAX,
  MCP_TIMEOUT_SECONDS_MIN,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
} from "~/lib/constants";
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
import { buildMcpServerConfigKey } from "~/lib/mcp/config-key";
import {
  isMcpHeaderCountWithinLimit,
  normalizeAndValidateMcpAzureAuthScope,
  validateMcpHeaderKey,
  validateMcpTimeoutSeconds,
} from "~/lib/mcp/validation";

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

type McpTransport = "streamable_http" | "sse" | "stdio";

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

const legacyUnavailableDefaultStdioNpxPackageNameSet = new Set<string>(
  MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
);

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
    if (!isRecord(entry)) {
      return { ok: false, error: `mcpServers[${index}] is invalid.` };
    }

    const rawName = typeof entry.name === "string" ? entry.name.trim() : "";

    const rawTransport = entry.transport;
    let transport: McpTransport;
    if (rawTransport === "sse") {
      transport = "sse";
    } else if (rawTransport === "stdio") {
      transport = "stdio";
    } else if (
      rawTransport === "streamable_http" ||
      rawTransport === undefined ||
      rawTransport === null
    ) {
      transport = "streamable_http";
    } else {
      return {
        ok: false,
        error: `mcpServers[${index}].transport must be \"streamable_http\", \"sse\", or \"stdio\".`,
      };
    }

    if (transport === "stdio") {
      const command = typeof entry.command === "string" ? entry.command.trim() : "";
      if (!command) {
        return { ok: false, error: `mcpServers[${index}].command is required for stdio.` };
      }

      if (/\s/.test(command)) {
        return { ok: false, error: `mcpServers[${index}].command must not include spaces.` };
      }

      const argsResult = parseStdioArgs(entry.args, index);
      if (!argsResult.ok) {
        return argsResult;
      }

      const envResult = parseStdioEnv(entry.env, index);
      if (!envResult.ok) {
        return envResult;
      }

      const cwd = typeof entry.cwd === "string" ? entry.cwd.trim() : "";
      const name = (rawName || command).slice(0, MCP_SERVER_NAME_MAX_LENGTH);
      if (!name) {
        return { ok: false, error: `mcpServers[${index}].name is required.` };
      }

      if (
        isLegacyUnavailableDefaultStdioNpxServer({
          command,
          args: argsResult.value,
          cwd: cwd || undefined,
          env: envResult.value,
        })
      ) {
        continue;
      }

      const config: ClientMcpStdioServerConfig = {
        name,
        transport,
        command,
        args: argsResult.value,
        cwd: cwd || undefined,
        env: envResult.value,
      };
      const dedupeKey = buildMcpServerConfigKey(config);
      if (dedupeKeys.has(dedupeKey)) {
        continue;
      }

      dedupeKeys.add(dedupeKey);
      result.push(config);
      continue;
    }

    const rawUrl = typeof entry.url === "string" ? entry.url.trim() : "";
    if (!rawUrl) {
      return { ok: false, error: `mcpServers[${index}].url is required.` };
    }

    const parsedHttpUrlResult = parseMcpHttpUrlForChat(rawUrl, index, options.requestUrl);
    if (!parsedHttpUrlResult.ok) {
      return parsedHttpUrlResult;
    }

    const name = (rawName || parsedHttpUrlResult.value.nameFallback).slice(
      0,
      MCP_SERVER_NAME_MAX_LENGTH,
    );
    if (!name) {
      return { ok: false, error: `mcpServers[${index}].name is required.` };
    }

    const headersResult = parseHttpHeaders(entry.headers, index);
    if (!headersResult.ok) {
      return headersResult;
    }

    const useAzureAuth = entry.useAzureAuth === true;
    const scopeResult = parseAzureAuthScope(entry.azureAuthScope, index, useAzureAuth);
    if (!scopeResult.ok) {
      return scopeResult;
    }

    const timeoutResult = parseTimeoutSeconds(entry.timeoutSeconds, index);
    if (!timeoutResult.ok) {
      return timeoutResult;
    }

    const config: ClientMcpHttpServerConfig = {
      name,
      transport,
      url: parsedHttpUrlResult.value.url,
      headers: headersResult.value,
      useAzureAuth,
      azureAuthScope: scopeResult.value,
      timeoutSeconds: timeoutResult.value,
    };

    const dedupeKey = buildMcpServerConfigKey(config);
    if (dedupeKeys.has(dedupeKey)) {
      continue;
    }

    dedupeKeys.add(dedupeKey);
    result.push(config);
  }

  return { ok: true, value: result };
}

function parseMcpHttpUrlForChat(
  rawUrl: string,
  index: number,
  requestUrl?: string,
): ParseResult<{ url: string; nameFallback: string }> {
  const requestOrigin = readRequestOrigin(requestUrl);
  if (rawUrl.startsWith("/") && !rawUrl.startsWith("//")) {
    if (!requestOrigin) {
      return { ok: false, error: `mcpServers[${index}].url is invalid.` };
    }

    let resolvedUrl: URL;
    try {
      resolvedUrl = new URL(rawUrl, requestOrigin);
    } catch {
      return { ok: false, error: `mcpServers[${index}].url is invalid.` };
    }

    if (resolvedUrl.protocol !== "http:" && resolvedUrl.protocol !== "https:") {
      return {
        ok: false,
        error: `mcpServers[${index}].url must start with http://, https://, or /.`,
      };
    }

    const pathSegments = resolvedUrl.pathname
      .split("/")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const nameFallback = pathSegments[pathSegments.length - 1] ?? resolvedUrl.hostname;
    return {
      ok: true,
      value: {
        url: resolvedUrl.toString(),
        nameFallback,
      },
    };
  }

  let parsedAbsoluteUrl: URL;
  try {
    parsedAbsoluteUrl = new URL(rawUrl);
  } catch {
    return { ok: false, error: `mcpServers[${index}].url is invalid.` };
  }

  if (parsedAbsoluteUrl.protocol !== "http:" && parsedAbsoluteUrl.protocol !== "https:") {
    return {
      ok: false,
      error: `mcpServers[${index}].url must start with http://, https://, or /.`,
    };
  }

  return {
    ok: true,
    value: {
      url: parsedAbsoluteUrl.toString(),
      nameFallback: parsedAbsoluteUrl.hostname,
    },
  };
}

function readRequestOrigin(requestUrl?: string): string | null {
  if (typeof requestUrl !== "string") {
    return null;
  }

  const trimmed = requestUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function isLegacyUnavailableDefaultStdioNpxServer(config: {
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
}): boolean {
  return (
    config.command === "npx" &&
    config.args.length === 2 &&
    config.args[0] === "-y" &&
    legacyUnavailableDefaultStdioNpxPackageNameSet.has(config.args[1]) &&
    !config.cwd &&
    Object.keys(config.env).length === 0
  );
}

function parseStdioArgs(argsValue: unknown, index: number): ParseResult<string[]> {
  if (argsValue === undefined || argsValue === null) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(argsValue)) {
    return { ok: false, error: `mcpServers[${index}].args must be an array of strings.` };
  }

  if (argsValue.length > MCP_STDIO_ARGS_MAX) {
    return {
      ok: false,
      error: `mcpServers[${index}].args can include up to ${MCP_STDIO_ARGS_MAX} entries.`,
    };
  }

  const args: string[] = [];
  for (const [argIndex, arg] of argsValue.entries()) {
    if (typeof arg !== "string") {
      return { ok: false, error: `mcpServers[${index}].args[${argIndex}] must be a string.` };
    }

    const trimmed = arg.trim();
    if (!trimmed) {
      return {
        ok: false,
        error: `mcpServers[${index}].args[${argIndex}] must not be empty.`,
      };
    }

    args.push(trimmed);
  }

  return { ok: true, value: args };
}

function parseStdioEnv(
  envValue: unknown,
  index: number,
): ParseResult<Record<string, string>> {
  if (envValue === undefined || envValue === null) {
    return { ok: true, value: {} };
  }

  if (!isRecord(envValue)) {
    return { ok: false, error: `mcpServers[${index}].env must be an object.` };
  }

  const entries = Object.entries(envValue);
  if (entries.length > MCP_STDIO_ENV_VARS_MAX) {
    return {
      ok: false,
      error: `mcpServers[${index}].env can include up to ${MCP_STDIO_ENV_VARS_MAX} entries.`,
    };
  }

  const env: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!ENV_KEY_PATTERN.test(key)) {
      return { ok: false, error: `mcpServers[${index}].env key \"${key}\" is invalid.` };
    }

    if (typeof value !== "string") {
      return { ok: false, error: `mcpServers[${index}].env[\"${key}\"] must be a string.` };
    }

    env[key] = value;
  }

  return { ok: true, value: env };
}

function parseHttpHeaders(
  headersValue: unknown,
  index: number,
): ParseResult<Record<string, string>> {
  if (headersValue === undefined || headersValue === null) {
    return { ok: true, value: {} };
  }

  if (!isRecord(headersValue)) {
    return { ok: false, error: `mcpServers[${index}].headers must be an object.` };
  }

  const entries = Object.entries(headersValue);
  if (!isMcpHeaderCountWithinLimit(entries.length)) {
    return {
      ok: false,
      error: `mcpServers[${index}].headers can include up to ${MCP_HTTP_HEADERS_MAX} entries.`,
    };
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of entries) {
    const headerKeyValidation = validateMcpHeaderKey(key);
    if (!headerKeyValidation.ok && headerKeyValidation.reason === "invalid_key") {
      return { ok: false, error: `mcpServers[${index}].headers key \"${key}\" is invalid.` };
    }

    if (!headerKeyValidation.ok && headerKeyValidation.reason === "reserved_content_type") {
      return {
        ok: false,
        error: `mcpServers[${index}].headers cannot include \"Content-Type\". It is fixed to \"application/json\".`,
      };
    }

    if (typeof value !== "string") {
      return {
        ok: false,
        error: `mcpServers[${index}].headers[\"${key}\"] must be a string.`,
      };
    }

    headers[key] = value;
  }

  return { ok: true, value: headers };
}

function parseAzureAuthScope(
  rawScope: unknown,
  index: number,
  useAzureAuth: boolean,
): ParseResult<string> {
  if (rawScope === undefined || rawScope === null) {
    return { ok: true, value: MCP_DEFAULT_AZURE_AUTH_SCOPE };
  }

  if (typeof rawScope !== "string") {
    return { ok: false, error: `mcpServers[${index}].azureAuthScope must be a string.` };
  }

  const scopeValidation = normalizeAndValidateMcpAzureAuthScope(rawScope);
  if (!scopeValidation.ok) {
    if (scopeValidation.reason === "too_long") {
      return {
        ok: false,
        error: `mcpServers[${index}].azureAuthScope must be ${MCP_AZURE_AUTH_SCOPE_MAX_LENGTH} characters or fewer.`,
      };
    }

    return {
      ok: false,
      error: `mcpServers[${index}].azureAuthScope must not include spaces.`,
    };
  }

  if (useAzureAuth && !scopeValidation.value) {
    return {
      ok: false,
      error: `mcpServers[${index}].azureAuthScope is required when useAzureAuth is true.`,
    };
  }

  return { ok: true, value: scopeValidation.value };
}

function parseTimeoutSeconds(rawTimeout: unknown, index: number): ParseResult<number> {
  if (rawTimeout === undefined || rawTimeout === null) {
    return { ok: true, value: MCP_DEFAULT_TIMEOUT_SECONDS };
  }

  if (typeof rawTimeout !== "number") {
    return { ok: false, error: `mcpServers[${index}].timeoutSeconds must be an integer.` };
  }

  const timeoutValidation = validateMcpTimeoutSeconds(rawTimeout);
  if (!timeoutValidation.ok) {
    if (timeoutValidation.reason === "not_integer") {
      return { ok: false, error: `mcpServers[${index}].timeoutSeconds must be an integer.` };
    }

    return {
      ok: false,
      error: `mcpServers[${index}].timeoutSeconds must be between ${MCP_TIMEOUT_SECONDS_MIN} and ${MCP_TIMEOUT_SECONDS_MAX}.`,
    };
  }

  return { ok: true, value: timeoutValidation.value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
