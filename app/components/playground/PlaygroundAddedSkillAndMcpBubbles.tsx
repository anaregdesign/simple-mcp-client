import { LabeledTooltip } from "~/components/shared/LabeledTooltip";
import { FluentUI } from "~/components/shared/fluent";
import type {
  ThreadMcpConnectionView,
  ThreadSkillView,
} from "~/lib/client/usecase/workspace/view-types";

const { Button } = FluentUI;

type PlaygroundAddedSkillAndMcpBubblesProps<
  TMcpServer extends ThreadMcpConnectionView,
> = {
  selectedThreadSkills: ThreadSkillView[];
  selectedMessageSkillActivations: ThreadSkillView[];
  mcpServers: TMcpServer[];
  isSending: boolean;
  isThreadReadOnly: boolean;
  onRemoveThreadSkill: (location: string) => void;
  onRemoveMessageSkillActivation: (location: string) => void;
  onRemoveMcpServer: (id: string) => void;
};

function buildMcpServerTooltipLines(server: ThreadMcpConnectionView) {
  if (server.transport === "stdio") {
    return [
      "Transport: stdio",
      `Command: ${server.command}${server.args.length > 0 ? ` ${server.args.join(" ")}` : ""}`,
      ...(server.cwd ? [`Working directory: ${server.cwd}`] : []),
      `Environment variables: ${Object.keys(server.env).length}`,
    ];
  }

  return [
    `Transport: ${server.transport}`,
    `URL: ${server.url}`,
    `Custom headers: ${Object.keys(server.headers).length}`,
    `Timeout: ${server.timeoutSeconds}s`,
    `Azure auth: ${server.useAzureAuth ? `enabled (${server.azureAuthScope})` : "disabled"}`,
  ];
}

export function PlaygroundAddedSkillAndMcpBubbles<
  TMcpServer extends ThreadMcpConnectionView,
>({
  selectedThreadSkills,
  selectedMessageSkillActivations,
  mcpServers,
  isSending,
  isThreadReadOnly,
  onRemoveThreadSkill,
  onRemoveMessageSkillActivation,
  onRemoveMcpServer,
}: PlaygroundAddedSkillAndMcpBubblesProps<TMcpServer>) {
  if (
    selectedThreadSkills.length === 0 &&
    selectedMessageSkillActivations.length === 0 &&
    mcpServers.length === 0
  ) {
    return null;
  }

  return (
    <section
      className="chat-skill-strip-compact"
      aria-label="Added thread skill activations, message skill activations, and thread MCP connections"
    >
      <div className="chat-skill-bubbles chat-skill-bubbles-compact">
        {selectedMessageSkillActivations.map((skill) => (
          <div
            key={`message_activation:${skill.location}`}
            className="chat-skill-bubble-item"
          >
            <LabeledTooltip
              title={skill.name}
              lines={[`Source: ${skill.location}`]}
            >
              <span className="chat-skill-bubble chat-skill-bubble-message-activation">
                <span className="chat-skill-bubble-name">{skill.name}</span>
                <Button
                  type="button"
                  appearance="subtle"
                  size="small"
                  className="chat-skill-bubble-remove"
                  onClick={() => onRemoveMessageSkillActivation(skill.location)}
                  disabled={isSending || isThreadReadOnly}
                  aria-label={`Remove message skill activation ${skill.name}`}
                  title={`Remove message skill activation ${skill.name}`}
                >
                  ×
                </Button>
              </span>
            </LabeledTooltip>
          </div>
        ))}
        {selectedThreadSkills.map((skill) => (
          <div key={`thread:${skill.location}`} className="chat-skill-bubble-item">
            <LabeledTooltip
              title={skill.name}
              lines={[`Source: ${skill.location}`]}
            >
              <span className="chat-skill-bubble chat-skill-bubble-thread">
                <span className="chat-skill-bubble-name">{skill.name}</span>
                <Button
                  type="button"
                  appearance="subtle"
                  size="small"
                  className="chat-skill-bubble-remove"
                  onClick={() => onRemoveThreadSkill(skill.location)}
                  disabled={isSending || isThreadReadOnly}
                  aria-label={`Remove thread skill ${skill.name}`}
                  title={`Remove thread skill ${skill.name}`}
                >
                  ×
                </Button>
              </span>
            </LabeledTooltip>
          </div>
        ))}
        {mcpServers.map((server) => (
          <div key={`mcp:${server.id}`} className="chat-skill-bubble-item">
            <LabeledTooltip
              title={server.name}
              lines={buildMcpServerTooltipLines(server)}
            >
              <span className="chat-skill-bubble chat-skill-bubble-mcp">
                <span className="chat-skill-bubble-name">{server.name}</span>
                <Button
                  type="button"
                  appearance="subtle"
                  size="small"
                  className="chat-skill-bubble-remove"
                  onClick={() => onRemoveMcpServer(server.id)}
                  disabled={isSending || isThreadReadOnly}
                  aria-label={`Remove MCP server ${server.name}`}
                  title={`Remove ${server.name}`}
                >
                  ×
                </Button>
              </span>
            </LabeledTooltip>
          </div>
        ))}
      </div>
    </section>
  );
}
