/**
 * Test module verifying client thread save-state helper behavior.
 */
import { describe, expect, it } from "vitest";
import {
  hasThreadPersistableState,
  hasThreadInteraction,
} from "~/lib/client/usecase/workspace/threads/thread-save-state";

describe("hasThreadInteraction", () => {
  it("returns false for threads without messages", () => {
    expect(hasThreadInteraction({ messages: [] })).toBe(false);
  });

  it("returns true for threads with selected skills", () => {
    expect(
      hasThreadInteraction({
        messages: [],
        skillSelections: [
          {
            name: "workspace-skill",
            location: "/repo/skills/workspace-skill/SKILL.md",
          },
        ],
      }),
    ).toBe(true);
  });

  it("returns true for threads with messages", () => {
    expect(
      hasThreadInteraction({
        messages: [
          {
            id: "message-1",
            role: "user",
            content: "Hello",
            createdAt: "2026-03-01T00:00:00.000Z",
            turnId: "turn-1",
            attachments: [],
            skillActivations: [],
          },
        ],
      }),
    ).toBe(true);
  });
});

describe("hasThreadPersistableState", () => {
  it("returns false when only default thread settings are present", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "none",
        webSearchEnabled: false,
        instructionContextToggles: { system: true },
        threadEnvironment: {},
        agentInstruction: "",
        chatAzureConfig: null,
      }),
    ).toBe(false);
  });

  it("returns true when reasoning effort differs from default", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "medium",
        webSearchEnabled: false,
        instructionContextToggles: { system: true },
        threadEnvironment: {},
        agentInstruction: "",
        chatAzureConfig: null,
      }),
    ).toBe(true);
  });

  it("returns true when web search is enabled", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "none",
        webSearchEnabled: true,
        instructionContextToggles: { system: true },
        threadEnvironment: {},
        agentInstruction: "",
        chatAzureConfig: null,
      }),
    ).toBe(true);
  });

  it("returns true when thread environment variables are present", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "none",
        webSearchEnabled: false,
        instructionContextToggles: { system: true },
        threadEnvironment: {
          VIRTUAL_ENV: "/tmp/.venv",
        },
        agentInstruction: "",
        chatAzureConfig: null,
      }),
    ).toBe(true);
  });

  it("returns true when instruction context toggles differ from defaults", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "none",
        webSearchEnabled: false,
        instructionContextToggles: { system: false },
        threadEnvironment: {},
        agentInstruction: "",
        chatAzureConfig: null,
      }),
    ).toBe(true);
  });

  it("returns true when agent instruction differs from the default", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "none",
        webSearchEnabled: false,
        agentInstruction: "Use short paragraphs and list tradeoffs.",
        instructionContextToggles: { system: true },
        threadEnvironment: {},
        chatAzureConfig: null,
      }),
    ).toBe(true);
  });

  it("returns true when chatAzureConfig is present", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "none",
        webSearchEnabled: false,
        chatAzureConfig: {
          tenantId: "tenant",
          projectId: "project",
          projectName: "Project",
          baseUrl: "https://example.openai.azure.com",
          apiVersion: "2026-01-01-preview",
          deploymentName: "gpt-5.2",
        },
        agentInstruction: "",
        instructionContextToggles: { system: true },
        threadEnvironment: {},
      }),
    ).toBe(true);
  });
});
