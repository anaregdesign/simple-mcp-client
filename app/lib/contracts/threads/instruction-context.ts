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
export type ThreadInstructionContextToggles = Record<
  ThreadInstructionContextToggleKey,
  boolean
>;

export const DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES: ThreadInstructionContextToggles =
  buildDefaultThreadInstructionContextToggles();

export function cloneThreadInstructionContextToggles(
  value: ThreadInstructionContextToggles,
): ThreadInstructionContextToggles {
  const cloned = {} as ThreadInstructionContextToggles;
  for (const option of THREAD_INSTRUCTION_CONTEXT_OPTIONS) {
    cloned[option.key] = value[option.key] === true;
  }

  return cloned;
}

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

export function hasNonDefaultThreadInstructionContextToggles(
  value: ThreadInstructionContextToggles,
): boolean {
  for (const option of THREAD_INSTRUCTION_CONTEXT_OPTIONS) {
    if (value[option.key] !== option.defaultEnabled) {
      return true;
    }
  }

  return false;
}

function buildDefaultThreadInstructionContextToggles(): ThreadInstructionContextToggles {
  const toggles = {} as ThreadInstructionContextToggles;
  for (const option of THREAD_INSTRUCTION_CONTEXT_OPTIONS) {
    toggles[option.key] = option.defaultEnabled;
  }

  return toggles;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
