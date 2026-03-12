/**
 * Client UI component module.
 */
import { useMemo } from "react";
import { clsx } from "clsx";
import type { ChangeEvent, RefObject } from "react";
import { FluentUI } from "~/components/shared/fluent";
import { ConfigSection } from "~/components/shared/ConfigSection";
import { SubSection } from "~/components/shared/SubSection";
import { CopyableAutoDismissStatusMessageList } from "~/components/CopyableAutoDismissStatusMessageList";
import { InfoIconButton } from "~/components/shared/InfoIconButton";
import { LabeledTooltip } from "~/components/shared/LabeledTooltip";
import configStyles from "~/components/shared/ConfigSection.module.css";
import { Diff, Hunk, parseDiff } from "react-diff-view";
import "react-diff-view/style/index.css";
import type {
  InstructionContextToggleOptionView,
  InstructionEnhanceComparisonView,
  InstructionLanguage,
} from "~/lib/client/usecase/workspace/instruction-editor/view-types";
import styles from "~/components/config/threads/InstructionSection.module.css";

const { Button, Spinner, Switch, Textarea } = FluentUI;

type InstructionSectionProps = {
  agentInstruction: string;
  instructionContextToggleOptions: InstructionContextToggleOptionView[];
  instructionEnhanceComparison: InstructionEnhanceComparisonView | null;
  describeInstructionLanguage: (language: InstructionLanguage) => string;
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
    key: InstructionContextToggleOptionView["key"],
    enabled: boolean,
  ) => void;
  onAgentInstructionChange: (value: string) => void;
  onOpenInstructionFilePicker: () => void;
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
    onOpenInstructionFilePicker,
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
      className={styles.root}
      title="Agent Instruction 🧾"
      description="System instruction used for the agent."
    >
      {isThreadReadOnly ? (
        <p className={configStyles.fieldHint}>
          This thread is archived and read-only. Restore it from Archives to edit instruction.
        </p>
      ) : null}
      {instructionEnhanceComparison ? (
        <section className={styles.diffPanel} aria-label="Instruction diff review">
          <div className={styles.diffHeader}>
            <p className={styles.diffTitle}>🔀 Enhanced Diff Preview</p>
            <div className={styles.diffActions}>
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
          <p className={styles.diffMeta}>
            Format: .{instructionEnhanceComparison.extension} | Language:{" "}
            {describeInstructionLanguage(instructionEnhanceComparison.language)}
          </p>
          {parsedDiffFiles.length > 0 ? (
            <div className={styles.diffTable} aria-label="Instruction diff">
              {parsedDiffFiles.map((file, index) => (
                <Diff
                  key={`${file.oldRevision ?? "old"}-${file.newRevision ?? "new"}-${index}`}
                  viewType="unified"
                  diffType={file.type}
                  hunks={file.hunks}
                  className={styles.diffGithub}
                >
                  {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
                </Diff>
              ))}
            </div>
          ) : (
            <pre className={styles.diffRaw} aria-label="Instruction diff">
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
            <div className={styles.enhancingState} role="status" aria-live="polite">
              <div className={styles.enhancingHead}>
                <Spinner size="tiny" />
                <span>Enhancing instruction with the selected Utility Model...</span>
              </div>
              <div className={styles.enhancingTrack} aria-hidden="true">
                <span className={styles.enhancingBar} />
              </div>
            </div>
          ) : null}
          <div className={styles.filePickerRow}>
            <input
              id="agent-instruction-file"
              ref={instructionFileInputRef}
              className={styles.hiddenFileInput}
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
              onClick={onOpenInstructionFilePicker}
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
            <span className={styles.filePickerName}>
              {loadedInstructionFileName ?? "No file loaded"}
            </span>
          </div>
        </>
      )}
      <CopyableAutoDismissStatusMessageList
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
        className={styles.contextSubsection}
        title="Context"
        description="Toggle which context payloads are injected when sending instruction-guided turns."
      >
        <div className={styles.contextToggleList} aria-label="Instruction context toggles">
          {instructionContextToggleOptions.map((option) => (
            <div key={option.key} className={styles.contextToggleItem}>
              <div className={styles.contextSwitchRow}>
                <Switch
                  id={`instruction-context-toggle-${option.key}`}
                  className={styles.contextSwitch}
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
                    className={configStyles.tooltipTarget}
                  >
                    <InfoIconButton
                      className={clsx(configStyles.tooltipIcon, styles.contextInfoIcon)}
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
