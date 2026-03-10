import {
  reasoningEffortValues,
  type ReasoningEffort,
} from "~/lib/domain/value-objects/reasoning-effort";

export type AzureOpenAIModelCapabilityModel = {
  name: string;
  version: string;
  format: string;
  capabilities: Record<string, unknown>;
};

export type AzureOpenAIModelCapabilitySource = {
  model: AzureOpenAIModelCapabilityModel | null;
};

export type AzureOpenAIDeploymentCapabilitySource = {
  provisioningState: string;
  model: AzureOpenAIModelCapabilityModel | null;
};

export type AzureOpenAIModelCapabilities = {
  flags: Record<string, boolean>;
  reasoningEffortOptions: ReasoningEffort[];
};

export function buildModelCapabilitiesMap(
  models: AzureOpenAIModelCapabilitySource[],
): Map<string, AzureOpenAIModelCapabilities> {
  const map = new Map<string, AzureOpenAIModelCapabilities>();

  for (const entry of models) {
    const model = entry.model;
    if (!model) {
      continue;
    }

    const name = model.name.trim().toLowerCase();
    const version = model.version.trim().toLowerCase();
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

export function isAgentsSdkCompatibleDeployment(
  deployment: AzureOpenAIDeploymentCapabilitySource,
  modelCapabilities: Map<string, AzureOpenAIModelCapabilities>,
): boolean {
  const model = deployment.model;
  if (!model) {
    return false;
  }

  const modelName = model.name.trim().toLowerCase();
  const modelVersion = model.version.trim().toLowerCase();
  const format = model.format.trim().toLowerCase();

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

export function resolveDeploymentReasoningEffortOptions(
  modelName: string,
  capabilities: AzureOpenAIModelCapabilities | undefined,
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
  const normalizedModelName = modelName.trim().toLowerCase();
  if (!normalizedModelName) {
    return [];
  }

  if (normalizedModelName.startsWith("o3-pro")) {
    return ["high"];
  }

  if (normalizedModelName.startsWith("gpt-5.4")) {
    return ["none", "low", "medium", "high", "xhigh"];
  }

  if (normalizedModelName.startsWith("gpt-5.2")) {
    return ["none", "low", "medium", "high", "xhigh"];
  }

  if (
    normalizedModelName.startsWith("gpt-5-chat") ||
    normalizedModelName.startsWith("gpt-5-codex")
  ) {
    return ["low", "medium", "high", "xhigh"];
  }

  if (normalizedModelName.startsWith("gpt-5")) {
    return ["minimal", "low", "medium", "high"];
  }

  if (normalizedModelName.startsWith("o1")) {
    return ["none", "low", "medium", "high"];
  }

  if (
    normalizedModelName.startsWith("o3") ||
    normalizedModelName.startsWith("o4-mini")
  ) {
    return ["low", "medium", "high"];
  }

  return [];
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
  return reasoningEffortValues.filter((option) => tokenSet.has(option));
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

export function isDeploymentSucceeded(
  deployment: AzureOpenAIDeploymentCapabilitySource,
): boolean {
  if (!deployment.provisioningState) {
    return true;
  }

  return deployment.provisioningState.trim().toLowerCase() === "succeeded";
}

export function createModelKey(modelName: string, modelVersion: string): string {
  return `${modelName}::${modelVersion}`;
}

function readModelCapabilities(
  value: unknown,
): AzureOpenAIModelCapabilities {
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

  if (keyLooksLikeReasoningEffort || key.includes("reasoning")) {
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
    if (
      key &&
      (key.includes("reasoning") ||
        key.includes("effort") ||
        key.includes("supported") ||
        key.includes("value"))
    ) {
      addReasoningEffortOptionsFromUnknown(rawEntryValue, target);
    }
  }
}

function orderReasoningEffortOptions(
  options: ReasoningEffort[],
): ReasoningEffort[] {
  const optionSet = new Set(options);
  return reasoningEffortValues.filter((effort) => optionSet.has(effort));
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
