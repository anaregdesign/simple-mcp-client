import { describe, expect, it, vi } from "vitest";
import {
  createSkillSelectionHandlers,
} from "~/lib/client/usecase/workspace/skills-catalog/handlers";
import { DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES } from "~/lib/contracts/threads/instruction-context";
import type { ThreadState } from "~/lib/contracts/threads/types";

function createThreadState(overrides: Partial<ThreadState> = {}): ThreadState {
  return {
    id: "thread-1",
    name: "Thread 1",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "medium",
    webSearchEnabled: false,
    agentInstruction: "",
    instructionContextToggles: DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
    threadEnvironment: {},
    messages: [],
    mcpServers: [],
    mcpRpcLogs: [],
    skillSelections: [],
    ...overrides,
  };
}

describe("createSkillSelectionHandlers", () => {
  it("dispatches registry mutation for the selected registry skill", () => {
    const updateSkillRegistrySkill = vi.fn().mockResolvedValue(undefined);
    const handlers = createSkillSelectionHandlers({
      availableSkillByLocation: new Map(),
      skillRegistryCatalogs: [
        {
          registryId: "openai_curated",
          registryLabel: "Registry",
          registryDescription: "Registry description",
          repository: "repo",
          repositoryUrl: "https://example.com/repo",
          sourcePath: "/skills",
          skills: [
            {
              id: "skill-1",
              name: "Skill 1",
              description: "Skill description",
              tag: null,
              remotePath: "repo/skill-1",
              installLocation: "/tmp/skill-1",
              isInstalled: true,
              isUpdateAvailable: false,
            },
          ],
        },
      ],
      readActiveThreadId: () => "thread-1",
      updateThreadStateById: () => {},
      setSelectedMessageSkillActivations: () => {},
      setSkillsError: () => {},
      updateSkillRegistrySkill,
    });

    handlers.handleToggleRegistrySkill("openai_curated", "skill-1");

    expect(updateSkillRegistrySkill).toHaveBeenCalledWith({
      action: "delete_registry_skill",
      registryId: "openai_curated",
      skillName: "skill-1",
    });
  });

  it("adds a thread skill from the available catalog and clears errors", () => {
    let wasUpdated = false;
    let nextThreadState = createThreadState();
    const setSkillsError = vi.fn();
    const handlers = createSkillSelectionHandlers({
      availableSkillByLocation: new Map([
        [
          "/skills/skill-a",
          {
            name: "Skill A",
            description: "Skill A description",
            location: "/skills/skill-a",
            source: "workspace",
          },
        ],
      ]),
      skillRegistryCatalogs: [],
      readActiveThreadId: () => "thread-1",
      updateThreadStateById: (_threadId, updater) => {
        wasUpdated = true;
        nextThreadState = updater(createThreadState());
      },
      setSelectedMessageSkillActivations: () => {},
      setSkillsError,
      updateSkillRegistrySkill: vi.fn().mockResolvedValue(undefined),
    });

    handlers.handleToggleThreadSkill("/skills/skill-a");

    expect(wasUpdated).toBe(true);
    expect(nextThreadState.skillSelections).toEqual([
      {
        name: "Skill A",
        location: "/skills/skill-a",
      },
    ]);
    expect(setSkillsError).toHaveBeenCalledWith(null);
  });
});
