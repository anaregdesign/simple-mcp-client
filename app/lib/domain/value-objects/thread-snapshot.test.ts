import { describe, expect, it } from "vitest";
import { Thread } from "~/lib/domain/entities/thread";
import {
  cloneThreadSnapshot,
  readThreadSnapshot,
  type ThreadSnapshot,
} from "~/lib/domain/value-objects/thread-snapshot";

function createThreadSnapshot(): ThreadSnapshot {
  return {
    id: "thread-a",
    userId: 1,
    name: "Thread A",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "medium",
    webSearchEnabled: false,
    chatAzureConfig: {
      tenantId: "tenant-a",
      projectId: "project-a",
      projectName: "Project A",
      baseUrl: "https://example.openai.azure.com",
      apiVersion: "2026-01-01-preview",
      deploymentName: "gpt-5",
    },
    agentConversationId: "conversation-a",
    threadEnvironment: {
      PATH: "/tmp/bin",
    },
    instructionContextToggles: {
      system: true,
    },
    instruction: {
      id: 1,
      threadId: "thread-a",
      content: "Focus on the current workspace.",
    },
    messages: [
      {
        id: "message-a",
        threadId: "thread-a",
        conversationOrder: 0,
        role: "user",
        content: "hello",
        createdAt: "2026-01-01T00:00:00.000Z",
        turnId: "turn-a",
        attachments: [],
        skillActivations: [],
      },
    ],
    mcpServers: [],
    operationLogs: [],
    skillSelections: [],
  };
}

describe("thread-snapshot", () => {
  it("clones nested snapshot state defensively", () => {
    const snapshot = createThreadSnapshot();
    const cloned = cloneThreadSnapshot(snapshot);

    cloned.threadEnvironment.PATH = "/custom/bin";
    cloned.chatAzureConfig!.projectName = "Updated";

    expect(snapshot.threadEnvironment.PATH).toBe("/tmp/bin");
    expect(snapshot.chatAzureConfig!.projectName).toBe("Project A");
  });

  it("reads a snapshot from the Thread aggregate", () => {
    const snapshot = readThreadSnapshot(new Thread(createThreadSnapshot()));

    expect(snapshot).toMatchObject({
      id: "thread-a",
      agentConversationId: "conversation-a",
      threadEnvironment: {
        PATH: "/tmp/bin",
      },
    });
  });
});
