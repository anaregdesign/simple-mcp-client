import type { ThreadInstructionContextToggleKey } from "~/lib/domain/value-objects/thread-instruction-context";

export type InstructionLanguage = "japanese" | "english" | "mixed" | "unknown";

export type InstructionEnhanceComparisonView = {
  extension: string;
  language: InstructionLanguage;
  diffPatch: string;
};

export type InstructionContextToggleOptionView = {
  key: ThreadInstructionContextToggleKey;
  label: string;
  infoTitle: string;
  infoLines: string[];
  enabled: boolean;
};
