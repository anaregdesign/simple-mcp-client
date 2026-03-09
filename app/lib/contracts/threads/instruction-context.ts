import type { ThreadInstructionContextToggles } from "~/lib/domain/entities/thread-record";

export {
  cloneThreadInstructionContextToggles,
  DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
  hasNonDefaultThreadInstructionContextToggles,
} from "~/lib/domain/entities/thread-record";
export type { ThreadInstructionContextToggles } from "~/lib/domain/entities/thread-record";

export const THREAD_INSTRUCTION_CONTEXT_OPTIONS = [
  {
    key: "system",
    label: "System Context",
    infoTitle: "System Context Injection",
    infoLines: [
      "Purpose: reduce context mismatch in responses and tool execution.",
      "Added data: current Thread/Turn IDs and signed-in Workspace user profile.",
      "Added data: selected Azure project/deployment/endpoint and OS details.",
    ],
    defaultEnabled: true,
  },
] as const;

export type ThreadInstructionContextToggleOption =
  (typeof THREAD_INSTRUCTION_CONTEXT_OPTIONS)[number];
export type ThreadInstructionContextToggleKey = ThreadInstructionContextToggleOption["key"];

export function readThreadInstructionContextTogglesFromUnknown(
  value: unknown,
): ThreadInstructionContextToggles | null {
  if (!isRecord(value)) {
    return null;
  }

  const toggles = {} as ThreadInstructionContextToggles;
  for (const option of THREAD_INSTRUCTION_CONTEXT_OPTIONS) {
    const rawToggle = value[option.key];
    if (typeof rawToggle !== "boolean") {
      return null;
    }
    toggles[option.key] = rawToggle;
  }

  return toggles;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
