import {
  AGENT_SKILL_READ_TEXT_DEFAULT_MAX_CHARS,
} from "~/lib/constants/skills";
import {
  cloneThreadEnvironment,
  type ThreadEnvironment,
} from "~/lib/domain/value-objects/thread-environment";
import {
  buildThreadOperationLogRequestId,
  type JsonRpcRequestPayload,
  type ThreadOperationLogRecord,
} from "~/lib/server/infrastructure/gateways/mcp/mcp-session-logging";
import type {
  ActiveSkillRuntimeEntry,
  SkillRuntimeContext,
} from "~/lib/server/usecase/chat/skill-runtime-types";
import { clipTextForSkillTool } from "~/lib/server/usecase/chat/skill-tool-text";

export function emitSkillActivationOperationLogs(
  runtime: SkillRuntimeContext,
  handlers: {
    nextSequence: () => number;
    onRecord: (record: ThreadOperationLogRecord) => void;
  },
  executionContext: {
    threadEnvironment: ThreadEnvironment;
  },
): void {
  const records = buildInitialSkillOperationRecords(runtime, {
    nextSequence: handlers.nextSequence,
    threadEnvironment: executionContext.threadEnvironment,
  });
  for (const record of records) {
    handlers.onRecord(record);
  }
}

export function buildInitialSkillOperationRecords(
  runtime: SkillRuntimeContext,
  options: {
    nextSequence: () => number;
    threadEnvironment: ThreadEnvironment;
  },
): ThreadOperationLogRecord[] {
  const records: ThreadOperationLogRecord[] = [];
  for (const skill of runtime.activeSkills) {
    records.push(buildSkillActivateOperationRecord(skill, options));
    if (skill.guidePreloadRequested) {
      records.push(buildSkillGuideReadOperationRecord(skill, options));
    }
  }
  if (runtime.activeSkills.length > 0) {
    records.push(buildSkillEnvironmentSnapshotOperationRecord(options));
  }
  return records;
}

export function isSkillOperationErrorResult(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  if (value.ok === false) {
    return true;
  }

  if (Object.hasOwn(value, "exitCode")) {
    return value.exitCode !== 0;
  }

  return false;
}

function buildSkillActivateOperationRecord(
  skill: ActiveSkillRuntimeEntry,
  options: {
    nextSequence: () => number;
    threadEnvironment: ThreadEnvironment;
  },
): ThreadOperationLogRecord {
  const sequence = options.nextSequence();
  const requestId = buildThreadOperationLogRequestId(skill.name, sequence);
  const startedAt = new Date().toISOString();

  return {
    id: requestId,
    sequence,
    operationType: "skill",
    serverName: skill.name,
    method: "skill/activate",
    startedAt,
    completedAt: new Date().toISOString(),
    request: {
      jsonrpc: "2.0",
      id: requestId,
      method: "skill/activate",
      params: {
        name: skill.name,
        location: skill.location,
        preloadMode: skill.guidePreloadRequested
          ? "full_guide"
          : "frontmatter_only",
        threadEnvironment: cloneThreadEnvironment(options.threadEnvironment),
      },
    },
    response: {
      jsonrpc: "2.0",
      id: requestId,
      result: {
        status: "active",
        preloadedFullGuide: skill.preloadedGuideMarkdown !== null,
        resources: {
          scripts: skill.scripts.length,
          references: skill.references.length,
          assets: skill.assets.length,
        },
      },
    },
    isError: false,
  };
}

function buildSkillGuideReadOperationRecord(
  skill: ActiveSkillRuntimeEntry,
  options: {
    nextSequence: () => number;
    threadEnvironment: ThreadEnvironment;
  },
): ThreadOperationLogRecord {
  const sequence = options.nextSequence();
  const requestId = buildThreadOperationLogRequestId(skill.name, sequence);
  const startedAt = new Date().toISOString();
  const request: JsonRpcRequestPayload = {
    jsonrpc: "2.0",
    id: requestId,
    method: "skill_read_guide",
    params: {
      skill: skill.location,
      maxChars: AGENT_SKILL_READ_TEXT_DEFAULT_MAX_CHARS,
      threadEnvironment: cloneThreadEnvironment(options.threadEnvironment),
    },
  };

  if (skill.preloadedGuideMarkdown === null) {
    return {
      id: requestId,
      sequence,
      operationType: "skill",
      serverName: skill.name,
      method: "skill_read_guide",
      startedAt,
      completedAt: new Date().toISOString(),
      request,
      response: {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          message:
            skill.preloadedGuideErrorMessage ??
            `Failed to preload SKILL.md for active Skill "${skill.name}".`,
        },
      },
      isError: true,
    };
  }

  const lineNormalized = skill.preloadedGuideMarkdown.replace(/\r\n?/g, "\n");
  const lines = lineNormalized.split("\n");
  const clipped = clipTextForSkillTool(
    lineNormalized,
    AGENT_SKILL_READ_TEXT_DEFAULT_MAX_CHARS,
  );

  return {
    id: requestId,
    sequence,
    operationType: "skill",
    serverName: skill.name,
    method: "skill_read_guide",
    startedAt,
    completedAt: new Date().toISOString(),
    request,
    response: {
      jsonrpc: "2.0",
      id: requestId,
      result: {
        ok: true,
        skill: skill.name,
        location: skill.location,
        path: "SKILL.md",
        startLine: 1,
        endLine: lines.length,
        totalLines: lines.length,
        truncated: clipped.truncated,
        text: clipped.value,
      },
    },
    isError: false,
  };
}

function buildSkillEnvironmentSnapshotOperationRecord(options: {
  nextSequence: () => number;
  threadEnvironment: ThreadEnvironment;
}): ThreadOperationLogRecord {
  const sequence = options.nextSequence();
  const requestId = buildThreadOperationLogRequestId("skill-runtime", sequence);
  const startedAt = new Date().toISOString();
  const threadEnvironment = cloneThreadEnvironment(options.threadEnvironment);

  return {
    id: requestId,
    sequence,
    operationType: "skill",
    serverName: "skill-runtime",
    method: "skill/environment_snapshot",
    startedAt,
    completedAt: new Date().toISOString(),
    request: {
      jsonrpc: "2.0",
      id: requestId,
      method: "skill/environment_snapshot",
      params: {
        threadEnvironment,
      },
    },
    response: {
      jsonrpc: "2.0",
      id: requestId,
      result: {
        threadEnvironment,
      },
    },
    isError: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
