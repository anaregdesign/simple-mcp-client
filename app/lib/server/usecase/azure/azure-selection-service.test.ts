import { describe, expect, it, vi } from "vitest";
import {
  AzureSelectionPreference,
} from "~/lib/domain/azure/azure-selection-preference";
import type {
  AzureSelectionPreferenceRepository,
} from "~/lib/domain/repositories/azure-selection-preference-repository";
import {
  AzureSelectionService,
} from "~/lib/server/usecase/azure/azure-selection-service";

function createRepositoryMock(): AzureSelectionPreferenceRepository {
  return {
    findByIdentity: vi.fn(),
    save: vi.fn(),
    deleteByIdentity: vi.fn(),
  };
}

describe("AzureSelectionService", () => {
  it("preserves existing playground selection when updating utility selection", async () => {
    const repository = createRepositoryMock();
    const existing = new AzureSelectionPreference({
      tenantId: "tenant-a",
      principalId: "principal-a",
      theme: "dark",
      playground: {
        projectId: "project-a",
        deploymentName: "deploy-a",
      },
      utility: null,
    });
    vi.mocked(repository.findByIdentity).mockResolvedValue(existing);
    vi.mocked(repository.save).mockImplementation(async (preference) => preference);

    const service = new AzureSelectionService(repository);
    const result = await service.saveStoredSelection(
      {
        tenantId: "tenant-a",
        principalId: "principal-a",
      },
      {
        target: "utility",
        projectId: "project-b",
        deploymentName: "deploy-b",
        reasoningEffort: "medium",
        theme: null,
      },
    );

    expect(result.created).toBe(false);
    expect(result.selection.playground).toEqual({
      projectId: "project-a",
      deploymentName: "deploy-a",
    });
    expect(result.selection.utility).toEqual({
      projectId: "project-b",
      deploymentName: "deploy-b",
      reasoningEffort: "medium",
    });
    expect(result.selection.theme).toBe("dark");
  });

  it("creates a theme-only selection when no record exists", async () => {
    const repository = createRepositoryMock();
    vi.mocked(repository.findByIdentity).mockResolvedValue(null);
    vi.mocked(repository.save).mockImplementation(async (preference) => preference);

    const service = new AzureSelectionService(repository);
    const result = await service.saveStoredSelection(
      {
        tenantId: "tenant-a",
        principalId: "principal-a",
      },
      {
        target: null,
        projectId: "",
        deploymentName: "",
        reasoningEffort: null,
        theme: "dark",
      },
    );

    expect(result.created).toBe(true);
    expect(result.selection.theme).toBe("dark");
    expect(result.selection.playground).toBeNull();
    expect(result.selection.utility).toBeNull();
  });
});
