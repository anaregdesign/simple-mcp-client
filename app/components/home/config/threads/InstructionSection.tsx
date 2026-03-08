/**
 * Home UI component module.
 */
import { useMemo } from "react";
import type { ChangeEvent, RefObject } from "react";
import { FluentUI } from "~/components/home/shared/fluent";
import { ConfigSection } from "~/components/home/shared/ConfigSection";
import { SubSection } from "~/components/home/shared/SubSection";
import { AutoDismissStatusMessageList } from "~/components/home/shared/AutoDismissStatusMessageList";
import { InfoIconButton } from "~/components/home/shared/InfoIconButton";
import { LabeledTooltip } from "~/components/home/shared/LabeledTooltip";
import { Diff, Hunk, parseDiff } from "react-diff-view";
import "react-diff-view/style/index.css";
import type { ThreadInstructionContextToggleKey } from "~/lib/home/thread/instruction-context";

const { Button, Spinner, Switch, Textarea } = FluentUI;

type InstructionLanguageLike = "japanese" | "english" | "mixed" | "unknown";

type InstructionEnhanceComparisonLike = {
  extension: string;
  language: InstructionLanguageLike;
  diffPatch: string;
};

type InstructionContextToggleOptionLike = {
  key: ThreadInstructionContextToggleKey;
  label: string;
  infoTitle: string;
  infoLines: string[];
  enabled: boolean;
};

type InstructionSectionProps = {
  agentInstruction: string;
  instructionContextToggleOptions: InstructionContextToggleOptionLike[];
  instructionEnhanceComparison: InstructionEnhanceComparisonLike | null;
  describeInstructionLanguage: (language: InstructionLanguageLike) => string;
  isSending: boolean;
  isThreadReadOnly: boolean;
  isEnhancingInstruction: boolean;
  showEnhancingInstructionSpinner: boolean;
  isSavingInstructionPrompt: boolean;
  canSaveAgentInstructionPrompt: boolean;
  canEnhanceAgentInstruction: boolean;
  canClearAgentInstruction: boolean;
  loadedInstructionFileName: string | null;
  instructionFileInputRef: RefObject<HTMLInputElement | null>;
  instructionFileError: string | null;
  instructionSaveError: string | null;
  instructionSaveSuccess: string | null;
  instructionEnhanceError: string | null;
  instructionEnhanceSuccess: string | null;
  onClearInstructionSaveSuccess: () => void;
  onClearInstructionEnhanceSuccess: () => void;
  onInstructionContextToggleChange: (
    key: ThreadInstructionContextToggleKey,
    enabled: boolean,
  ) => void;
  onAgentInstructionChange: (value: string) => void;
  onInstructionFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onSaveInstructionPrompt: () => void | Promise<void>;
  onEnhanceInstruction: () => void | Promise<void>;
  onClearInstruction: () => void;
  onAdoptEnhancedInstruction: () => void;
  onAdoptOriginalInstruction: () => void;
};

export function InstructionSection(props: InstructionSectionProps) {
  const {
    agentInstruction,
    instructionContextToggleOptions,
    instructionEnhanceComparison,
    describeInstructionLanguage,
    isSending,
    isThreadReadOnly,
    isEnhancingInstruction,
    showEnhancingInstructionSpinner,
    isSavingInstructionPrompt,
    canSaveAgentInstructionPrompt,
    canEnhanceAgentInstruction,
    canClearAgentInstruction,
    loadedInstructionFileName,
    instructionFileInputRef,
    instructionFileError,
    instructionSaveError,
    instructionSaveSuccess,
    instructionEnhanceError,
    instructionEnhanceSuccess,
    onClearInstructionSaveSuccess,
    onClearInstructionEnhanceSuccess,
    onInstructionContextToggleChange,
    onAgentInstructionChange,
    onInstructionFileChange,
    onSaveInstructionPrompt,
    onEnhanceInstruction,
    onClearInstruction,
    onAdoptEnhancedInstruction,
    onAdoptOriginalInstruction,
  } = props;
  const parsedDiffFiles = useMemo(
    () => (instructionEnhanceComparison ? parseDiff(instructionEnhanceComparison.diffPatch) : []),
    [instructionEnhanceComparison],
  );

  return (
    <ConfigSection
      className="setting-group-agent-instruction"
      title="Agent Instruction 🧾"
      description="System instruction used for the agent."
    >
      {isThreadReadOnly ? (
        <p className="field-hint">
          This thread is archived and read-only. Restore it from Archives to edit instruction.
        </p>
      ) : null}
      {instructionEnhanceComparison ? (
        <section className="instruction-diff-panel" aria-label="Instruction diff review">
          <div className="instruction-diff-header">
            <p className="instruction-diff-title">🔀 Enhanced Diff Preview</p>
            <div className="instruction-diff-actions">
              <Button
                type="button"
                appearance="primary"
                size="small"
                title="Use the enhanced instruction text."
                onClick={onAdoptEnhancedInstruction}
                disabled={isSending || isEnhancingInstruction || isThreadReadOnly}
              >
                ✅ Adopt Enhanced
              </Button>
              <Button
                type="button"
                appearance="secondary"
                size="small"
                title="Keep the original instruction text."
                onClick={onAdoptOriginalInstruction}
                disabled={isSending || isEnhancingInstruction || isThreadReadOnly}
              >
                ↩️ Keep Original
              </Button>
            </div>
          </div>
          <p className="instruction-diff-meta">
            Format: .{instructionEnhanceComparison.extension} | Language:{" "}
            {describeInstructionLanguage(instructionEnhanceComparison.language)}
          </p>
          {parsedDiffFiles.length > 0 ? (
            <div className="instruction-diff-table" aria-label="Instruction diff">
              {parsedDiffFiles.map((file, index) => (
                <Diff
                  key={`${file.oldRevision ?? "old"}-${file.newRevision ?? "new"}-${index}`}
                  viewType="unified"
                  diffType={file.type}
                  hunks={file.hunks}
                  className="instruction-diff-github"
                >
                  {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
                </Diff>
              ))}
            </div>
          ) : (
            <pre className="instruction-diff-raw" aria-label="Instruction diff">
              <code>{instructionEnhanceComparison.diffPatch}</code>
            </pre>
          )}
        </section>
      ) : (
        <>
          <Textarea
            id="agent-instruction"
            rows={6}
            title="System instruction text sent to the agent."
            value={agentInstruction}
            onChange={(_, data) => {
              onAgentInstructionChange(data.value);
            }}
            disabled={isSending || isEnhancingInstruction || isThreadReadOnly}
            placeholder="System instruction for the agent"
          />
          {showEnhancingInstructionSpinner ? (
            <div className="instruction-enhancing-state" role="status" aria-live="polite">
              <div className="instruction-enhancing-head">
                <Spinner size="tiny" />
                <span>Enhancing instruction with the selected Utility Model...</span>
              </div>
              <div className="instruction-enhancing-track" aria-hidden="true">
                <span className="instruction-enhancing-bar" />
              </div>
            </div>
          ) : null}
          <div className="file-picker-row">
            <input
              id="agent-instruction-file"
              ref={instructionFileInputRef}
              className="file-input-hidden"
              type="file"
              accept=".md,.txt,.xml,.json,text/plain,text/markdown,application/json,application/xml,text/xml"
              onChange={(event) => {
                void onInstructionFileChange(event);
              }}
              disabled={isSending || isEnhancingInstruction || isThreadReadOnly}
            />
            <Button
              type="button"
              appearance="secondary"
              size="small"
              title="Load instruction content from a local file."
              onClick={() => instructionFileInputRef.current?.click()}
              disabled={isSending || isEnhancingInstruction || isThreadReadOnly}
            >
              📂 Load File
            </Button>
            <Button
              type="button"
              appearance="secondary"
              size="small"
              title="Save current instruction to a local file."
              onClick={() => {
                void onSaveInstructionPrompt();
              }}
              disabled={
                isSending ||
                isSavingInstructionPrompt ||
                isEnhancingInstruction ||
                isThreadReadOnly ||
                !canSaveAgentInstructionPrompt
              }
            >
              {isSavingInstructionPrompt ? "💾 Saving..." : "💾 Save"}
            </Button>
            <Button
              type="button"
              appearance="primary"
              size="small"
              title="Enhance the instruction using the selected Utility Model."
              onClick={() => {
                void onEnhanceInstruction();
              }}
              disabled={
                isSending || isEnhancingInstruction || isThreadReadOnly || !canEnhanceAgentInstruction
              }
            >
              {isEnhancingInstruction ? "✨ Enhancing..." : "✨ Enhance"}
            </Button>
            <Button
              type="button"
              appearance="secondary"
              size="small"
              title="Clear instruction text and related form values."
              onClick={onClearInstruction}
              disabled={
                isSending || isEnhancingInstruction || isThreadReadOnly || !canClearAgentInstruction
              }
            >
              🧹 Clear
            </Button>
            <span className="file-picker-name">{loadedInstructionFileName ?? "No file loaded"}</span>
          </div>
        </>
      )}
      <AutoDismissStatusMessageList
        messages={[
          { intent: "error", text: instructionFileError },
          { intent: "error", text: instructionSaveError },
          {
            intent: "success",
            text: instructionSaveSuccess,
            onClear: onClearInstructionSaveSuccess,
          },
          { intent: "error", text: instructionEnhanceError },
          {
            intent: "success",
            text: instructionEnhanceSuccess,
            onClear: onClearInstructionEnhanceSuccess,
          },
        ]}
      />
      <SubSection
        className="instruction-context-subsection"
        title="Context"
        description="Toggle which context payloads are injected when sending instruction-guided turns."
      >
        <div className="instruction-context-toggle-list" aria-label="Instruction context toggles">
          {instructionContextToggleOptions.map((option) => (
            <div key={option.key} className="instruction-context-toggle-item">
              <div className="instruction-context-toggle-switch-row">
                <Switch
                  id={`instruction-context-toggle-${option.key}`}
                  className="instruction-context-toggle-switch"
                  label={option.label}
                  checked={option.enabled}
                  onChange={(_, data) => {
                    onInstructionContextToggleChange(option.key, data.checked === true);
                  }}
                  disabled={isSending || isEnhancingInstruction || isThreadReadOnly}
                />
                {option.infoLines.length > 0 ? (
                  <LabeledTooltip
                    title={option.infoTitle}
                    lines={option.infoLines}
                    className="setting-group-tooltip-target"
                  >
                    <InfoIconButton
                      className="setting-group-tooltip-icon instruction-context-toggle-info-icon"
                      ariaLabel={`Show ${option.label} injection details`}
                      title={`Show ${option.label} injection details`}
                    />
                  </LabeledTooltip>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SubSection>
    </ConfigSection>
  );
}
