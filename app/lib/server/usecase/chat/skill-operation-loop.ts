import {
  CHAT_MAX_IDENTICAL_SKILL_OPERATION_CALLS_PER_SIGNATURE,
  CHAT_MAX_IDENTICAL_SKILL_RUN_SCRIPT_CALLS_PER_SIGNATURE,
  CHAT_MAX_SKILL_OPERATION_CALLS_PER_SERVER_METHOD,
  CHAT_MAX_SKILL_RUN_SCRIPT_CALLS_PER_SERVER_METHOD,
} from "~/lib/constants/chat";

export function buildSkillOperationLoopSignature(
  serverName: string,
  method: string,
  input: unknown,
): string {
  return JSON.stringify({
    serverName,
    method,
    input: normalizeObjectKeyOrder(toSerializableValue(input)),
  });
}

export function updateSkillOperationLoopState(
  current: {
    signature: string;
    consecutiveCount: number;
  },
  nextSignature: string,
): {
  signature: string;
  consecutiveCount: number;
} {
  if (current.signature === nextSignature) {
    return {
      signature: nextSignature,
      consecutiveCount: current.consecutiveCount + 1,
    };
  }

  return {
    signature: nextSignature,
    consecutiveCount: 1,
  };
}

export function updateSkillOperationErrorLoopState(
  current: {
    signature: string;
    errorSignature: string;
    consecutiveCount: number;
  },
  nextSignature: string,
  nextErrorSignature: string,
): {
  signature: string;
  errorSignature: string;
  consecutiveCount: number;
} {
  if (
    current.signature === nextSignature &&
    current.errorSignature === nextErrorSignature
  ) {
    return {
      signature: nextSignature,
      errorSignature: nextErrorSignature,
      consecutiveCount: current.consecutiveCount + 1,
    };
  }

  return {
    signature: nextSignature,
    errorSignature: nextErrorSignature,
    consecutiveCount: 1,
  };
}

export function buildSkillOperationErrorSignature(value: unknown): string {
  const maxLength = 512;
  const normalize = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return "unknown";
    }

    return trimmed.length > maxLength
      ? `${trimmed.slice(0, maxLength)}...`
      : trimmed;
  };

  if (typeof value === "string") {
    return normalize(value);
  }

  if (value instanceof Error) {
    return normalize(value.message);
  }

  if (isRecord(value)) {
    const narrowed: Record<string, unknown> = {};
    const errorMessage = readTrimmedString(value.error);
    if (errorMessage) {
      narrowed.error = errorMessage;
    }
    if (Object.hasOwn(value, "exitCode")) {
      narrowed.exitCode = toSerializableValue(value.exitCode);
    }
    const stderr = readTrimmedString(value.stderr);
    if (stderr) {
      narrowed.stderr = stderr;
    }
    const signal = readTrimmedString(value.signal);
    if (signal) {
      narrowed.signal = signal;
    }
    if (typeof value.timedOut === "boolean") {
      narrowed.timedOut = value.timedOut;
    }

    if (Object.keys(narrowed).length > 0) {
      const serializedNarrowed = JSON.stringify(
        normalizeObjectKeyOrder(narrowed),
      );
      return normalize(serializedNarrowed ?? "unknown");
    }
  }

  const serialized = JSON.stringify(
    normalizeObjectKeyOrder(toSerializableValue(value)),
  );
  return normalize(serialized ?? "unknown");
}

export function buildRepeatedSkillOperationLoopMessage(options: {
  serverName: string;
  method: string;
  consecutiveCount: number;
}): string {
  return `Detected a repeated Skill operation loop for ${options.serverName}.${options.method} (${options.consecutiveCount} identical consecutive calls). Stopped early to avoid exceeding max turns.`;
}

export function incrementSkillOperationCount(
  countsByServerMethod: Map<string, number>,
  serverName: string,
  method: string,
): number {
  const key = buildSkillOperationCountKey(serverName, method);
  const nextCount = (countsByServerMethod.get(key) ?? 0) + 1;
  countsByServerMethod.set(key, nextCount);
  return nextCount;
}

export function readSkillOperationCallLimit(method: string): number {
  return method === "skill_run_script"
    ? CHAT_MAX_SKILL_RUN_SCRIPT_CALLS_PER_SERVER_METHOD
    : CHAT_MAX_SKILL_OPERATION_CALLS_PER_SERVER_METHOD;
}

export function readSkillOperationSignatureCallLimit(method: string): number {
  return method === "skill_run_script"
    ? CHAT_MAX_IDENTICAL_SKILL_RUN_SCRIPT_CALLS_PER_SIGNATURE
    : CHAT_MAX_IDENTICAL_SKILL_OPERATION_CALLS_PER_SIGNATURE;
}

export function buildSkillOperationCountExceededMessage(options: {
  serverName: string;
  method: string;
  count: number;
}): string {
  return `Detected excessive Skill operation usage for ${options.serverName}.${options.method} (${options.count} calls in one run). Stopped early to avoid exceeding max turns.`;
}

export function buildSkillOperationErrorCountExceededMessage(options: {
  errorCount: number;
}): string {
  return `Detected too many Skill operation errors in one run (${options.errorCount}). Stopped early to avoid repeated failures.`;
}

export function buildSkillOperationSignatureCountExceededMessage(options: {
  serverName: string;
  method: string;
  count: number;
}): string {
  return `Detected repeated identical Skill operation errors for ${options.serverName}.${options.method} (${options.count} consecutive identical errors without recurrence-prevention change). Stopped early to avoid redundant retries.`;
}

export function shouldCacheSkillOperationResult(method: string): boolean {
  return (
    method === "skill_list_resources" ||
    method === "skill_read_guide" ||
    method === "skill_read_reference" ||
    method === "skill_read_asset"
  );
}

function buildSkillOperationCountKey(
  serverName: string,
  method: string,
): string {
  return `${serverName}::${method}`;
}

function toSerializableValue(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function normalizeObjectKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeObjectKeyOrder(item));
  }
  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  const sortedEntries = Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  for (const [key, entryValue] of sortedEntries) {
    normalized[key] = normalizeObjectKeyOrder(entryValue);
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
