import {
  CHAT_MAX_CONSECUTIVE_IDENTICAL_SKILL_OPERATIONS,
  CHAT_MAX_SKILL_OPERATION_ERRORS,
} from "~/lib/constants/chat";
import {
  AGENT_SKILL_READ_TEXT_DEFAULT_MAX_CHARS,
  AGENT_SKILL_READ_TEXT_MAX_CHARS,
  AGENT_SKILL_SCRIPT_ARG_MAX_LENGTH,
  AGENT_SKILL_SCRIPT_MAX_ARGS,
  AGENT_SKILL_SCRIPT_TIMEOUT_MAX_MS,
  AGENT_SKILL_TOOL_RESOURCE_PREVIEW_MAX_FILES,
} from "~/lib/constants/skills";
import {
  cloneThreadEnvironment,
  type ThreadEnvironment,
  THREAD_ENVIRONMENT_KEY_MAX_LENGTH,
  THREAD_ENVIRONMENT_KEY_PATTERN,
  THREAD_ENVIRONMENT_VARIABLES_MAX,
} from "~/lib/domain/value-objects/thread-environment";
import { buildStdioSpawnEnvironment } from "~/lib/server/infrastructure/gateways/chat/stdio-runtime-path";
import {
  buildThreadOperationLogRequestId,
  type JsonRpcRequestPayload,
  type JsonRpcResponsePayload,
  type ThreadOperationLogRecord,
} from "~/lib/server/infrastructure/gateways/mcp/mcp-session-logging";
import type { ActiveSkillRuntimeEntry } from "~/lib/server/infrastructure/gateways/skills/chat-skill-runtime";
import type { SkillResourceKind } from "~/lib/server/infrastructure/gateways/skills/skill-runtime";
import { isSkillOperationErrorResult } from "~/lib/server/infrastructure/gateways/skills/skill-operation-records";
import {
  buildRepeatedSkillOperationLoopMessage,
  buildSkillOperationCountExceededMessage,
  buildSkillOperationErrorCountExceededMessage,
  buildSkillOperationErrorSignature,
  buildSkillOperationLoopSignature,
  buildSkillOperationSignatureCountExceededMessage,
  incrementSkillOperationCount,
  readSkillOperationCallLimit,
  readSkillOperationSignatureCallLimit,
  shouldCacheSkillOperationResult,
  updateSkillOperationErrorLoopState,
  updateSkillOperationLoopState,
} from "~/lib/server/usecase/chat/skill-operation-loop";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

type SkillToolCategory = SkillResourceKind;

type SkillOperationLoopState = {
  signature: string;
  consecutiveCount: number;
};

type SkillOperationCountState = {
  byServerMethod: Map<string, number>;
  errorCount: number;
};

type SkillOperationErrorLoopState = {
  signature: string;
  errorSignature: string;
  consecutiveCount: number;
};

type SkillOperationCachedResult = {
  rawResult: string;
  parsedResult: unknown;
  isError: boolean;
};

export type SkillToolLogHandlers = {
  nextSequence: () => number;
  onRecord: (record: ThreadOperationLogRecord) => void;
};

export type SkillToolExecutionContext = {
  threadEnvironment: ThreadEnvironment;
};

export type SkillSelectionResult =
  | { ok: true; skills: ActiveSkillRuntimeEntry[] }
  | { ok: false; error: string };

export type SkillToolRuntime = {
  activeSkills: ActiveSkillRuntimeEntry[];
  threadEnvironment: ThreadEnvironment;
  resolveSkillSelection: (
    selectorValue: unknown,
    options: { allowAllWhenMissing: boolean },
  ) => SkillSelectionResult;
  executeWithSkillOperationLog: (
    method: string,
    input: unknown,
    execute: () => Promise<string> | string,
  ) => Promise<string>;
  readCurrentThreadEnvironment: () => ThreadEnvironment;
  buildSkillResourcePreview: (
    skill: ActiveSkillRuntimeEntry,
    selectedCategory: SkillToolCategory | null,
  ) => Record<string, unknown>;
  buildSkillToolResult: (payload: Record<string, unknown>) => string;
  buildSkillToolErrorResult: (message: string) => string;
  buildSkillScriptRunFailureMessage: (result: {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
    stderr: string;
  }) => string;
  readSkillToolCategory: (value: unknown) => SkillToolCategory | null;
  readInteger: (value: unknown) => number | null;
  readTrimmedString: (value: unknown) => string;
  normalizeSkillReadMaxChars: (value: unknown) => number;
  readSkillScriptArgs: (value: unknown) => ParseResult<string[]>;
  normalizeSkillScriptTimeout: (value: unknown) => number | undefined;
  buildSkillScriptEnvironment: (
    threadEnvironment: ThreadEnvironment,
  ) => Record<string, string>;
  readUnsetThreadEnvironmentKeys: (value: unknown) => ParseResult<string[]>;
  expandThreadEnvironmentTemplate: (
    value: string,
    environment: ThreadEnvironment,
  ) => string;
  isRecord: (value: unknown) => value is Record<string, unknown>;
  readErrorMessage: (error: unknown) => string;
};

export function createSkillToolRuntime(
  activeSkills: ActiveSkillRuntimeEntry[],
  logHandlers: SkillToolLogHandlers,
  executionContext: SkillToolExecutionContext,
): SkillToolRuntime {
  const activeSkillsByName = new Map<string, ActiveSkillRuntimeEntry[]>();
  for (const skill of activeSkills) {
    const list = activeSkillsByName.get(skill.name) ?? [];
    list.push(skill);
    activeSkillsByName.set(skill.name, list);
  }

  const resolveSkillSelection = (
    selectorValue: unknown,
    options: {
      allowAllWhenMissing: boolean;
    },
  ): SkillSelectionResult => {
    const selector = readTrimmedString(selectorValue);
    if (!selector) {
      if (options.allowAllWhenMissing) {
        return { ok: true, skills: activeSkills };
      }

      if (activeSkills.length === 1) {
        return { ok: true, skills: [activeSkills[0]] };
      }

      return {
        ok: false,
        error:
          "Multiple Skills are active. Provide `skill` by name or location.",
      };
    }

    const byLocation = activeSkills.find((skill) => skill.location === selector);
    if (byLocation) {
      return { ok: true, skills: [byLocation] };
    }

    const byName = activeSkillsByName.get(selector) ?? [];
    if (byName.length === 1) {
      return { ok: true, skills: byName };
    }

    if (byName.length > 1) {
      return {
        ok: false,
        error: "Skill name is ambiguous. Provide the full `skill` location.",
      };
    }

    return {
      ok: false,
      error: `Active Skill not found: ${selector}`,
    };
  };

  const readSkillOperationServerName = (input: unknown): string => {
    if (isRecord(input)) {
      const selector = readTrimmedString(input.skill);
      if (selector) {
        return selector;
      }
    }

    if (activeSkills.length === 1) {
      return activeSkills[0]?.name ?? "skill-runtime";
    }

    return "skill-runtime";
  };

  const readCurrentThreadEnvironment = (): ThreadEnvironment =>
    cloneThreadEnvironment(executionContext.threadEnvironment);

  const readSkillOperationParams = (input: unknown): Record<string, unknown> => {
    const threadEnvironment = cloneThreadEnvironment(
      executionContext.threadEnvironment,
    );
    if (!isRecord(input)) {
      return {
        input: toSerializableValue(input),
        threadEnvironment,
      };
    }

    const serialized = toSerializableValue(input);
    const baseParams = isRecord(serialized) ? serialized : {};
    return {
      ...baseParams,
      threadEnvironment,
    };
  };

  const parseSkillOperationResult = (result: string): unknown => {
    const trimmed = result.trim();
    if (!trimmed) {
      return "";
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return result;
    }
  };

  let skillOperationLoopState: SkillOperationLoopState = {
    signature: "",
    consecutiveCount: 0,
  };
  let skillOperationErrorLoopState: SkillOperationErrorLoopState = {
    signature: "",
    errorSignature: "",
    consecutiveCount: 0,
  };
  const skillOperationCountState: SkillOperationCountState = {
    byServerMethod: new Map<string, number>(),
    errorCount: 0,
  };
  const skillOperationCachedResultBySignature = new Map<
    string,
    SkillOperationCachedResult
  >();

  const resetSkillOperationErrorLoopState = () => {
    skillOperationErrorLoopState = {
      signature: "",
      errorSignature: "",
      consecutiveCount: 0,
    };
  };

  const applySkillOperationErrorGuards = (options: {
    method: string;
    serverName: string;
    operationSignature: string;
    errorPayload: unknown;
  }): void => {
    const errorSignature = buildSkillOperationErrorSignature(
      options.errorPayload,
    );
    skillOperationErrorLoopState = updateSkillOperationErrorLoopState(
      skillOperationErrorLoopState,
      options.operationSignature,
      errorSignature,
    );
    const operationSignatureCallLimit = readSkillOperationSignatureCallLimit(
      options.method,
    );
    if (
      skillOperationErrorLoopState.consecutiveCount >
      operationSignatureCallLimit
    ) {
      throw new Error(
        buildSkillOperationSignatureCountExceededMessage({
          serverName: options.serverName,
          method: options.method,
          count: skillOperationErrorLoopState.consecutiveCount,
        }),
      );
    }

    skillOperationCountState.errorCount += 1;
    if (skillOperationCountState.errorCount > CHAT_MAX_SKILL_OPERATION_ERRORS) {
      throw new Error(
        buildSkillOperationErrorCountExceededMessage({
          errorCount: skillOperationCountState.errorCount,
        }),
      );
    }
  };

  const executeWithSkillOperationLog = async (
    method: string,
    input: unknown,
    execute: () => Promise<string> | string,
  ): Promise<string> => {
    const operationParams = readSkillOperationParams(input);
    const sequence = logHandlers.nextSequence();
    const serverName = readSkillOperationServerName(input);
    const requestId = buildThreadOperationLogRequestId(serverName, sequence);
    const startedAt = new Date().toISOString();
    const requestPayload: JsonRpcRequestPayload = {
      jsonrpc: "2.0",
      id: requestId,
      method,
      params: operationParams,
    };
    const operationCountForServerMethod = incrementSkillOperationCount(
      skillOperationCountState.byServerMethod,
      serverName,
      method,
    );
    const operationCallLimit = readSkillOperationCallLimit(method);
    if (operationCountForServerMethod > operationCallLimit) {
      const operationCountErrorMessage =
        buildSkillOperationCountExceededMessage({
          serverName,
          method,
          count: operationCountForServerMethod,
        });
      const responsePayload: JsonRpcResponsePayload = {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          message: operationCountErrorMessage,
        },
      };
      logHandlers.onRecord({
        id: requestId,
        sequence,
        operationType: "skill",
        serverName,
        method,
        startedAt,
        completedAt: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        isError: true,
      });
      throw new Error(operationCountErrorMessage);
    }

    const operationSignature = buildSkillOperationLoopSignature(
      serverName,
      method,
      method === "skill_run_script" ? operationParams : input,
    );
    skillOperationLoopState = updateSkillOperationLoopState(
      skillOperationLoopState,
      operationSignature,
    );
    if (
      skillOperationLoopState.consecutiveCount >
      CHAT_MAX_CONSECUTIVE_IDENTICAL_SKILL_OPERATIONS
    ) {
      const loopErrorMessage = buildRepeatedSkillOperationLoopMessage({
        serverName,
        method,
        consecutiveCount: skillOperationLoopState.consecutiveCount,
      });
      const responsePayload: JsonRpcResponsePayload = {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          message: loopErrorMessage,
        },
      };
      logHandlers.onRecord({
        id: requestId,
        sequence,
        operationType: "skill",
        serverName,
        method,
        startedAt,
        completedAt: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        isError: true,
      });
      throw new Error(loopErrorMessage);
    }

    const cachedResult =
      skillOperationCachedResultBySignature.get(operationSignature);
    if (cachedResult) {
      const responsePayload: JsonRpcResponsePayload = {
        jsonrpc: "2.0",
        id: requestId,
        result: cachedResult.parsedResult,
      };
      logHandlers.onRecord({
        id: requestId,
        sequence,
        operationType: "skill",
        serverName,
        method,
        startedAt,
        completedAt: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        isError: cachedResult.isError,
      });
      if (cachedResult.isError) {
        applySkillOperationErrorGuards({
          method,
          serverName,
          operationSignature,
          errorPayload: cachedResult.parsedResult,
        });
      } else {
        resetSkillOperationErrorLoopState();
      }

      return cachedResult.rawResult;
    }

    let result: string;
    try {
      result = await execute();
    } catch (error) {
      const errorMessage = readErrorMessage(error);
      const responsePayload: JsonRpcResponsePayload = {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          message: errorMessage,
        },
      };

      logHandlers.onRecord({
        id: requestId,
        sequence,
        operationType: "skill",
        serverName,
        method,
        startedAt,
        completedAt: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        isError: true,
      });

      applySkillOperationErrorGuards({
        method,
        serverName,
        operationSignature,
        errorPayload: errorMessage,
      });
      throw error;
    }

    const parsedResult = parseSkillOperationResult(result);
    const skillOperationErrored = isSkillOperationErrorResult(parsedResult);
    if (shouldCacheSkillOperationResult(method)) {
      skillOperationCachedResultBySignature.set(operationSignature, {
        rawResult: result,
        parsedResult,
        isError: skillOperationErrored,
      });
    }
    const responsePayload: JsonRpcResponsePayload = {
      jsonrpc: "2.0",
      id: requestId,
      result: parsedResult,
    };

    logHandlers.onRecord({
      id: requestId,
      sequence,
      operationType: "skill",
      serverName,
      method,
      startedAt,
      completedAt: new Date().toISOString(),
      request: requestPayload,
      response: responsePayload,
      isError: skillOperationErrored,
    });
    if (skillOperationErrored) {
      applySkillOperationErrorGuards({
        method,
        serverName,
        operationSignature,
        errorPayload: parsedResult,
      });
    } else {
      resetSkillOperationErrorLoopState();
    }

    return result;
  };

  return {
    activeSkills,
    threadEnvironment: executionContext.threadEnvironment,
    resolveSkillSelection,
    executeWithSkillOperationLog,
    readCurrentThreadEnvironment,
    buildSkillResourcePreview,
    buildSkillToolResult,
    buildSkillToolErrorResult,
    buildSkillScriptRunFailureMessage,
    readSkillToolCategory,
    readInteger,
    readTrimmedString,
    normalizeSkillReadMaxChars,
    readSkillScriptArgs,
    normalizeSkillScriptTimeout,
    buildSkillScriptEnvironment,
    readUnsetThreadEnvironmentKeys,
    expandThreadEnvironmentTemplate,
    isRecord,
    readErrorMessage,
  };
}

function buildSkillResourcePreview(
  skill: ActiveSkillRuntimeEntry,
  selectedCategory: SkillToolCategory | null,
): Record<string, unknown> {
  const categories = selectedCategory
    ? ([selectedCategory] as const)
    : (["scripts", "references", "assets"] as const);
  const payload: Record<string, unknown> = {
    name: skill.name,
    location: skill.location,
  };

  for (const category of categories) {
    const sourceEntries =
      category === "scripts"
        ? skill.scripts
        : category === "references"
          ? skill.references
          : skill.assets;
    const previewEntries = sourceEntries.slice(
      0,
      AGENT_SKILL_TOOL_RESOURCE_PREVIEW_MAX_FILES,
    );
    const categoryTruncated =
      category === "scripts"
        ? skill.scriptsTruncated
        : category === "references"
          ? skill.referencesTruncated
          : skill.assetsTruncated;

    payload[category] = previewEntries.map((entry) => ({
      path: entry.path,
      sizeBytes: entry.sizeBytes,
    }));
    payload[`${category}Total`] = sourceEntries.length;
    payload[`${category}Truncated`] =
      categoryTruncated || sourceEntries.length > previewEntries.length;
  }

  return payload;
}

function buildSkillToolResult(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

function buildSkillToolErrorResult(message: string): string {
  return buildSkillToolResult({
    ok: false,
    error: message,
  });
}

function buildSkillScriptRunFailureMessage(result: {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stderr: string;
}): string {
  const stderr = result.stderr.trim();
  if (stderr) {
    return stderr;
  }

  if (result.timedOut) {
    return "Skill script timed out.";
  }

  if (result.signal) {
    return `Skill script terminated by signal ${result.signal}.`;
  }

  if (result.exitCode === null) {
    return "Skill script failed with an unknown exit status.";
  }

  return `Skill script exited with code ${result.exitCode}.`;
}

function readSkillToolCategory(value: unknown): SkillToolCategory | null {
  return value === "scripts" || value === "references" || value === "assets"
    ? value
    : null;
}

function readInteger(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isSafeInteger(value)
  ) {
    return null;
  }

  return value;
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSkillReadMaxChars(value: unknown): number {
  const parsedValue = readInteger(value);
  if (!parsedValue || parsedValue <= 0) {
    return AGENT_SKILL_READ_TEXT_DEFAULT_MAX_CHARS;
  }

  return Math.min(parsedValue, AGENT_SKILL_READ_TEXT_MAX_CHARS);
}

function readSkillScriptArgs(value: unknown): ParseResult<string[]> {
  if (value === undefined) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(value)) {
    return { ok: false, error: "args must be an array of strings." };
  }

  if (value.length > AGENT_SKILL_SCRIPT_MAX_ARGS) {
    return {
      ok: false,
      error: `args can include up to ${AGENT_SKILL_SCRIPT_MAX_ARGS} values.`,
    };
  }

  const args: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string") {
      return { ok: false, error: `args[${index}] must be a string.` };
    }
    if (entry.length > AGENT_SKILL_SCRIPT_ARG_MAX_LENGTH) {
      return {
        ok: false,
        error: `args[${index}] must be ${AGENT_SKILL_SCRIPT_ARG_MAX_LENGTH} characters or fewer.`,
      };
    }

    args.push(entry);
  }

  return { ok: true, value: args };
}

function normalizeSkillScriptTimeout(value: unknown): number | undefined {
  const parsedValue = readInteger(value);
  if (!parsedValue || parsedValue <= 0) {
    return undefined;
  }

  return Math.min(parsedValue, AGENT_SKILL_SCRIPT_TIMEOUT_MAX_MS);
}

function buildSkillScriptEnvironment(
  threadEnvironment: ThreadEnvironment,
): Record<string, string> {
  const baseEnvironment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      baseEnvironment[key] = value;
    }
  }

  for (const [key, value] of Object.entries(threadEnvironment)) {
    baseEnvironment[key] = value;
  }

  return buildStdioSpawnEnvironment(baseEnvironment);
}

function readUnsetThreadEnvironmentKeys(value: unknown): ParseResult<string[]> {
  if (value === undefined || value === null) {
    return {
      ok: true,
      value: [],
    };
  }

  if (!Array.isArray(value)) {
    return {
      ok: false,
      error: "`unset` must be an array of environment variable names.",
    };
  }

  if (value.length > THREAD_ENVIRONMENT_VARIABLES_MAX) {
    return {
      ok: false,
      error: `\`unset\` can include up to ${THREAD_ENVIRONMENT_VARIABLES_MAX} entries.`,
    };
  }

  const unique = new Set<string>();
  const keys: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string") {
      return {
        ok: false,
        error: `unset[${index}] must be a string.`,
      };
    }

    const key = entry.trim();
    if (
      key.length === 0 ||
      key.length > THREAD_ENVIRONMENT_KEY_MAX_LENGTH ||
      !THREAD_ENVIRONMENT_KEY_PATTERN.test(key)
    ) {
      return {
        ok: false,
        error:
          `unset[${index}] is invalid. ` +
          `Keys must match ${THREAD_ENVIRONMENT_KEY_PATTERN.toString()} and be ` +
          `${THREAD_ENVIRONMENT_KEY_MAX_LENGTH} characters or fewer.`,
      };
    }

    if (unique.has(key)) {
      continue;
    }

    unique.add(key);
    keys.push(key);
  }

  return {
    ok: true,
    value: keys,
  };
}

function expandThreadEnvironmentTemplate(
  value: string,
  environment: ThreadEnvironment,
): string {
  return value.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
    (_match, variableName: string) => {
      const threadValue = environment[variableName];
      if (typeof threadValue === "string") {
        return threadValue;
      }

      const processValue = process.env[variableName];
      return typeof processValue === "string" ? processValue : "";
    },
  );
}

function toSerializableValue(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
