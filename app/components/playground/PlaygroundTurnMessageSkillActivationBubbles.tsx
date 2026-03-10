import { LabeledTooltip } from "~/components/shared/LabeledTooltip";
import type { ThreadMessageView } from "~/lib/client/usecase/workspace/view-types";

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
      className="message-skill-activation-row"
      aria-label="Message Skill Activations used in this turn"
    >
      {skillActivations.map((skill) => (
        <div
          key={`${message.id}:message-skill-activation:${skill.location}`}
          className="message-skill-activation-item"
        >
          <LabeledTooltip title={skill.name} lines={[`Source: ${skill.location}`]}>
            <span className="message-skill-activation-bubble">{skill.name}</span>
          </LabeledTooltip>
        </div>
      ))}
    </div>
  );
}
