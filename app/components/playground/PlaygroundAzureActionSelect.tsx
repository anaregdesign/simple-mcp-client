import type { KeyboardEvent } from "react";
import { FluentUI } from "~/components/shared/fluent";

const { Select } = FluentUI;

type PlaygroundAzureActionSelectProps = {
  target: "project" | "deployment";
  label: string;
  text: string;
  title: string;
  disabled: boolean;
  onAction: (target: "project" | "deployment") => void;
};

export function handlePlaygroundAzureActionSelectKeyDown(
  event: Pick<KeyboardEvent<HTMLSelectElement>, "key" | "preventDefault">,
  onAction: () => void,
) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  onAction();
}

export function PlaygroundAzureActionSelect({
  target,
  label,
  text,
  title,
  disabled,
  onAction,
}: PlaygroundAzureActionSelectProps) {
  const elementId =
    target === "project"
      ? "chat-azure-project-action"
      : "chat-azure-deployment-action";

  return (
    <Select
      id={elementId}
      aria-label={label}
      value=""
      onMouseDown={(event) => {
        event.preventDefault();
        onAction(target);
      }}
      onClick={(event) => {
        event.preventDefault();
        onAction(target);
      }}
      onKeyDown={(event) => {
        handlePlaygroundAzureActionSelectKeyDown(event, () => onAction(target));
      }}
      disabled={disabled}
      title={title}
    >
      <option value="">{text}</option>
    </Select>
  );
}
