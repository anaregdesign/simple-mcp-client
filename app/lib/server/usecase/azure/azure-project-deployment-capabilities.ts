import { REASONING_EFFORT_OPTIONS } from "~/lib/constants/chat";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

export type ArmModelInfo = {
  name?: string;
  version?: string;
  format?: string;
  capabilities?: Record<string, unknown>;
};

export type ArmCognitiveDeployment = {
  name?: string;
  properties?: {
    provisioningState?: string;
    model?: ArmModelInfo;
  };
};

export type ArmAccountModel = {
  model?: ArmModelInfo;
};

export type ModelCapabilities = {
  flags: Record<string, boolean>;
  reasoningEffortOptions: ReasoningEffort[];
};

export function buildModelCapabilitiesMap(
  models: ArmAccountModel[],
): Map<string, ModelCapabilities> {
  const map = new Map<string, ModelCapabilities>();

  for (const entry of models) {
    const model = entry.model;
    if (!model) {
      continue;
    }

    const name =
      typeof model.name === "string" ? model.name.trim().toLowerCase() : "";
    const version =
      typeof model.version === "string"
        ? model.version.trim().toLowerCase()
        : "";
    if (!name) {
      continue;
    }

    const capabilities = readModelCapabilities(model.capabilities);
    map.set(createModelKey(name, version), capabilities);
    if (version) {
      map.set(createModelKey(name, ""), capabilities);
    }
  }

  return map;
}

function readModelCapabilities(value: unknown): ModelCapabilities {
  if (!isRecord(value)) {
    return {
      flags: {},
      reasoningEffortOptions: [],
    };
  }

  const flags: Record<string, boolean> = {};
  const reasoningEffortOptionSet = new Set<ReasoningEffort>();
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = rawKey.trim().toLowerCase();
    if (!key) {
      continue;
    }
    flags[key] = parseCapabilityBoolean(rawValue);
    collectReasoningEffortOptionsFromCapability(
      rawKey,
      rawValue,
      reasoningEffortOptionSet,
    );
  }

  return {
    flags,
    reasoningEffortOptions: orderReasoningEffortOptions([
      ...reasoningEffortOptionSet,
    ]),
  };
}

function parseCapabilityBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "enabled"
  );
}

export function isAgentsSdkCompatibleDeployment(
  deployment: ArmCognitiveDeployment,
  modelCapabilities: Map<string, ModelCapabilities>,
): boolean {
  const model = deployment.properties?.model;
  if (!model) {
    return false;
  }

  const modelName =
    typeof model.name === "string" ? model.name.trim().toLowerCase() : "";
  const modelVersion =
    typeof model.version === "string" ? model.version.trim().toLowerCase() : "";
  const format =
    typeof model.format === "string" ? model.format.trim().toLowerCase() : "";

  if (!modelName || isUnsupportedModelName(modelName)) {
    return false;
  }

  if (format && !format.includes("openai")) {
    return false;
  }

  const capabilities =
    modelCapabilities.get(createModelKey(modelName, modelVersion)) ??
    modelCapabilities.get(createModelKey(modelName, ""));

  if (capabilities) {
    if (supportsChatCompletion(capabilities.flags)) {
      return true;
    }

    if (supportsNonChatOnly(capabilities.flags)) {
      return false;
    }
  }

  return looksLikeChatModelName(modelName);
}

function supportsChatCompletion(
  capabilities: Record<string, boolean>,
): boolean {
  return (
    capabilities.chatcompletion === true ||
    capabilities.chatcompletions === true ||
    capabilities.completion === true ||
    capabilities.completions === true
  );
}

function supportsNonChatOnly(capabilities: Record<string, boolean>): boolean {
  const chat = supportsChatCompletion(capabilities);
  if (chat) {
    return false;
  }

  return (
    capabilities.embedding === true ||
    capabilities.embeddings === true ||
    capabilities.audio === true ||
    capabilities.audiotranscription === true ||
    capabilities.audiotranslation === true ||
    capabilities.imagegeneration === true ||
    capabilities.images === true
  );
}

export function resolveDeploymentReasoningEffortOptions(
  modelName: string,
  capabilities: ModelCapabilities | undefined,
): ReasoningEffort[] {
  const modelSpecificOptions =
    resolveReasoningEffortOptionsByModelName(modelName);
  if (modelSpecificOptions.length > 0) {
    return modelSpecificOptions;
  }

  if (capabilities && capabilities.reasoningEffortOptions.length > 0) {
    return capabilities.reasoningEffortOptions;
  }

  return [];
}

export function resolveReasoningEffortOptionsByModelName(
  modelName: string,
): ReasoningEffort[] {
  if (!modelName) {
    return [];
  }

  if (modelName.startsWith("o3-pro")) {
    return ["high"];
  }

  if (modelName.startsWith("gpt-5.4")) {
    return ["none", "low", "medium", "high", "xhigh"];
  }

  if (modelName.startsWith("gpt-5.2")) {
    return ["none", "low", "medium", "high", "xhigh"];
  }

  if (
    modelName.startsWith("gpt-5-chat") ||
    modelName.startsWith("gpt-5-codex")
  ) {
    return ["low", "medium", "high", "xhigh"];
  }

  if (modelName.startsWith("gpt-5")) {
    return ["minimal", "low", "medium", "high"];
  }

  if (modelName.startsWith("o1")) {
    return ["none", "low", "medium", "high"];
  }

  if (modelName.startsWith("o3") || modelName.startsWith("o4-mini")) {
    return ["low", "medium", "high"];
  }

  return [];
}

function collectReasoningEffortOptionsFromCapability(
  rawKey: string,
  rawValue: unknown,
  target: Set<ReasoningEffort>,
): void {
  const key = rawKey.trim().toLowerCase();
  if (!key) {
    return;
  }

  const keyLooksLikeReasoningEffort =
    key.includes("reasoning") &&
    (key.includes("effort") ||
      key.includes("level") ||
      key.includes("setting"));
  const keyLooksLikeReasoning = key.includes("reasoning");

  if (keyLooksLikeReasoningEffort) {
    addReasoningEffortOptionsFromUnknown(rawValue, target);
    return;
  }

  if (keyLooksLikeReasoning) {
    addReasoningEffortOptionsFromUnknown(rawValue, target);
  }
}

function addReasoningEffortOptionsFromUnknown(
  value: unknown,
  target: Set<ReasoningEffort>,
): void {
  if (typeof value === "string") {
    for (const effort of parseReasoningEffortOptionsFromString(value)) {
      target.add(effort);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      addReasoningEffortOptionsFromUnknown(entry, target);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [rawKey, rawEntryValue] of Object.entries(value)) {
    const key = rawKey.trim().toLowerCase();
    if (!key) {
      continue;
    }
    if (
      key.includes("reasoning") ||
      key.includes("effort") ||
      key.includes("supported") ||
      key.includes("value")
    ) {
      addReasoningEffortOptionsFromUnknown(rawEntryValue, target);
    }
  }
}

export function parseReasoningEffortOptionsFromString(
  value: string,
): ReasoningEffort[] {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  let tokens = normalized.split(/[^a-z]+/g).filter(Boolean);
  if (tokens.length === 1) {
    try {
      const parsed = JSON.parse(normalized.replace(/'/g, '"')) as unknown;
      if (Array.isArray(parsed)) {
        tokens = parsed
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean);
      }
    } catch {
      // Best effort parsing only.
    }
  }

  const tokenSet = new Set(tokens);
  return REASONING_EFFORT_OPTIONS.filter((option) => tokenSet.has(option));
}

export function mergeReasoningEffortOptions(
  current: ReasoningEffort[],
  incoming: ReasoningEffort[],
): ReasoningEffort[] {
  if (current.length === 0) {
    return [...incoming];
  }
  if (incoming.length === 0) {
    return [...current];
  }
  return orderReasoningEffortOptions([...current, ...incoming]);
}

function orderReasoningEffortOptions(
  options: ReasoningEffort[],
): ReasoningEffort[] {
  const optionSet = new Set(options);
  return REASONING_EFFORT_OPTIONS.filter((effort) => optionSet.has(effort));
}

function isUnsupportedModelName(modelName: string): boolean {
  return (
    modelName.startsWith("text-embedding") ||
    modelName.includes("embedding") ||
    modelName.startsWith("whisper") ||
    modelName.startsWith("tts") ||
    modelName.startsWith("dall-e") ||
    modelName.startsWith("gpt-image") ||
    modelName.includes("moderation")
  );
}

function looksLikeChatModelName(modelName: string): boolean {
  return /^gpt/.test(modelName) || /^o[1-9]/.test(modelName);
}

export function isDeploymentSucceeded(
  deployment: ArmCognitiveDeployment,
): boolean {
  const state = deployment.properties?.provisioningState;
  if (typeof state !== "string") {
    return true;
  }

  return state.trim().toLowerCase() === "succeeded";
}

export function createModelKey(modelName: string, modelVersion: string): string {
  return `${modelName}::${modelVersion}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
