import { LabeledTooltip } from "~/components/shared/LabeledTooltip";
import type { ThreadMessageView } from "~/lib/client/usecase/workspace/playground-panel/view-types";
import styles from "~/components/playground/PlaygroundTurnMessageSkillActivationBubbles.module.css";

type PlaygroundTurnMessageSkillActivationBubblesProps<
  TMessage extends ThreadMessageView,
> = {
  message: TMessage;
};

export function PlaygroundTurnMessageSkillActivationBubbles<
  TMessage extends ThreadMessageView,
>({ message }: PlaygroundTurnMessageSkillActivationBubblesProps<TMessage>) {
  if (message.role !== "user") {
    return null;
  }

  const skillActivations = message.skillActivations ?? [];
  if (skillActivations.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.row}
      aria-label="Message Skill Activations used in this turn"
    >
      {skillActivations.map((skill) => (
        <div
          key={`${message.id}:message-skill-activation:${skill.location}`}
          className={styles.item}
        >
          <LabeledTooltip title={skill.name} lines={[`Source: ${skill.location}`]}>
            <span className={styles.bubble}>{skill.name}</span>
          </LabeledTooltip>
        </div>
      ))}
    </div>
  );
}
