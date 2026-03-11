import type { InstructionLanguage } from "~/lib/client/usecase/workspace/instruction-editor/view-types";

export type InstructionEnhanceComparison = {
  original: string;
  enhanced: string;
  extension: string;
  language: InstructionLanguage;
  diffPatch: string;
};
