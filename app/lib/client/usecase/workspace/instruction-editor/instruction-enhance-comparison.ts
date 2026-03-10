import type { InstructionLanguage } from "~/lib/client/usecase/workspace/view-types";

export type InstructionEnhanceComparison = {
  original: string;
  enhanced: string;
  extension: string;
  language: InstructionLanguage;
  diffPatch: string;
};
