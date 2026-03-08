/**
 * Impact scope:
 * These constants define instruction file validation, enhancement, persistence UX, and diff patch contracts.
 * Changing them affects instruction upload/save constraints and enhancement prompts.
 */
export const INSTRUCTION_MAX_FILE_SIZE_BYTES = 1_000_000;
export const INSTRUCTION_MAX_FILE_SIZE_LABEL = "1MB";
export const INSTRUCTION_ALLOWED_EXTENSIONS = new Set(["md", "txt", "xml", "json"]);
export const INSTRUCTION_DEFAULT_EXTENSION = "txt";
export const INSTRUCTION_ENHANCE_SYSTEM_PROMPT = [
  "<enhance_instruction_policy>",
  "  <primary_objective>",
  "    Revise the provided instruction so it faithfully realizes the user's intent.",
  "    Remove contradictions, ambiguity, redundancy, and clear typos/spelling mistakes.",
  "  </primary_objective>",
  "  <editing_boundaries>",
  "    Preserve intended meaning, constraints, and safety boundaries.",
  "    Do not add new requirements not implied by the source.",
  "    Preserve language and file-format style requested by the user.",
  "    Preserve original information as much as possible.",
  "    Remove details only when needed to resolve contradiction, ambiguity, or redundancy.",
  "    Do not omit, summarize, truncate, or replace any part with placeholders.",
  "    Do not insert comments like 'omitted', '省略', 'same as original', or similar markers.",
  "  </editing_boundaries>",
  "  <diff_contract>",
  "    Revise the instruction by producing structured unified-diff hunks against the original content.",
  "    Return exactly one patch target in fileName and follow the requested fileName.",
  "    Return hunks ordered by oldStart in strictly ascending order.",
  "    Do not return overlapping hunks or duplicate source ranges.",
  "    oldStart/newStart must reference exact 1-based line numbers in the source text.",
  "    Context/remove lines must match original source lines exactly.",
  "    Include sufficient context lines around edits so hunks can be applied reliably.",
  "  </diff_contract>",
  "  <reasoning_and_output>",
  "    Think step-by-step internally before answering, but never reveal your reasoning.",
  "    Before finalizing, run an internal checklist for objective completion, schema validity, and patch consistency.",
  "    Do not return the full rewritten instruction text.",
  "    If any internal check fails, return the requested fileName with an empty hunks array.",
  "    Return only structured output that matches the schema. No explanations or markdown fences.",
  "  </reasoning_and_output>",
  "</enhance_instruction_policy>",
].join("\n");

export type InstructionSaveFileType = {
  description?: string;
  accept: Record<string, string[]>;
};

export const INSTRUCTION_SAVE_FILE_TYPES: InstructionSaveFileType[] = [
  {
    description: "Instruction files",
    accept: {
      "text/markdown": [".md"],
      "text/plain": [".txt"],
      "application/json": [".json"],
      "application/xml": [".xml"],
      "text/xml": [".xml"],
    },
  },
];

export const PROMPT_DEFAULT_FILE_STEM = "instruction";
export const PROMPT_DEFAULT_FILE_EXTENSION = ".md";
export const PROMPT_MAX_FILE_STEM_LENGTH = 64;
export const PROMPT_MAX_FILE_NAME_LENGTH = 128;
export const PROMPT_MAX_CONTENT_BYTES = 1_000_000;
export const PROMPT_ALLOWED_FILE_EXTENSIONS = new Set([".md", ".txt", ".xml", ".json"]);

export const INSTRUCTION_DIFF_PATCH_FILE_NAME_PATTERN =
  /^[A-Za-z0-9._-]+\.(?:md|txt|xml|json)$/;
export const INSTRUCTION_DIFF_PATCH_MAX_HUNKS = 256;
export const INSTRUCTION_DIFF_PATCH_MAX_HUNK_LINES = 512;
export const INSTRUCTION_DIFF_PATCH_MAX_LINE_TEXT_LENGTH = 4_000;
export const INSTRUCTION_DIFF_PATCH_OUTPUT_TYPE = {
  type: "json_schema" as const,
  name: "instruction_diff_patch",
  strict: true,
  schema: {
    type: "object" as const,
    description: "Structured patch hunks for instruction enhancement.",
    properties: {
      fileName: {
        type: "string",
        description: "Target file name for the instruction patch, e.g. instruction.md",
        minLength: 1,
        maxLength: 128,
        pattern: "^[A-Za-z0-9._-]+\\.(?:md|txt|xml|json)$",
      },
      hunks: {
        type: "array",
        description: "Unified diff-style hunks.",
        maxItems: INSTRUCTION_DIFF_PATCH_MAX_HUNKS,
        items: {
          type: "object",
          properties: {
            oldStart: {
              type: "integer",
              minimum: 0,
              description:
                "1-based start line in original text. Use 0 only for pure insertion at start.",
            },
            newStart: {
              type: "integer",
              minimum: 0,
              description: "1-based start line in revised text.",
            },
            lines: {
              type: "array",
              minItems: 1,
              maxItems: INSTRUCTION_DIFF_PATCH_MAX_HUNK_LINES,
              items: {
                type: "object",
                properties: {
                  op: {
                    type: "string",
                    enum: ["context", "add", "remove"],
                  },
                  text: {
                    type: "string",
                    maxLength: INSTRUCTION_DIFF_PATCH_MAX_LINE_TEXT_LENGTH,
                  },
                },
                required: ["op", "text"],
                additionalProperties: false,
              },
            },
          },
          required: ["oldStart", "newStart", "lines"],
          additionalProperties: false,
        },
      },
    },
    required: ["fileName", "hunks"] as Array<"fileName" | "hunks">,
    additionalProperties: false as const,
  },
};
