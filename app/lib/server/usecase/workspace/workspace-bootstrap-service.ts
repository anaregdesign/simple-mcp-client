import { getAzureDependencies } from "~/lib/server/infrastructure/azure/dependencies";
import {
  getArmAccessToken,
  resolveAzurePrincipalProfile,
  type AzurePrincipalProfile,
} from "~/lib/server/infrastructure/azure/arm-access-context";
import {
  azureProjectQueryService,
  parseProjectId,
  type AzureDeployment,
  type AzureProject,
  type AzureTenant,
} from "~/lib/server/usecase/azure/azure-project-service";
import {
  type AzureSelectionService,
  type AzureSelectionPreference,
} from "~/lib/server/usecase/azure/azure-selection-service";
import {
  type McpServerProfileService,
} from "~/lib/server/usecase/mcp/mcp-server-profile-service";
import {
  type WorkspaceSkillService,
  type SkillDiscoveryResult,
} from "~/lib/server/usecase/skills/workspace-skill-service";
import { type ThreadQueryService } from "~/lib/server/usecase/threads/thread-service";
import type { AuthenticatedWorkspaceUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import type { WorkspaceMcpServerProfileResource } from "~/lib/contracts/mcp/profile";
import type { ThreadResource } from "~/lib/contracts/threads/types";

type WorkspaceBootstrapOptions = {
  request: Request;
  user: AuthenticatedWorkspaceUser;
};

type WorkspaceBootstrapData = {
  tenantId: string;
  principalId: string;
  principal: AzurePrincipalProfile | null;
  azureProjects: AzureProject[];
  azureTenants: AzureTenant[];
  azureSelection: AzureSelectionPreference | null;
  azureDeploymentsByProjectId: Record<string, AzureDeployment[]>;
  threads: ThreadResource[];
  workspaceMcpServerProfiles: WorkspaceMcpServerProfileResource[];
  skills: SkillDiscoveryResult["skills"];
  skillRegistries: SkillDiscoveryResult["registries"];
  skillWarnings: string[];
  registryWarnings: string[];
  warnings: string[];
  desktopStatus: null;
};

type WorkspaceBootstrapDependencies = {
  azureSelectionService: AzureSelectionService;
  mcpServerProfileService: McpServerProfileService;
  threadQueryService: ThreadQueryService;
  workspaceSkillService: WorkspaceSkillService;
};

export class WorkspaceBootstrapService {
  constructor(
    private readonly dependencies: WorkspaceBootstrapDependencies,
  ) {}

  async loadWorkspaceBootstrap(
    options: WorkspaceBootstrapOptions,
  ): Promise<WorkspaceBootstrapData | null> {
    const azureDependencies = getAzureDependencies();
    const tokenResult = await getArmAccessToken(azureDependencies);
    if (!tokenResult.ok) {
      return null;
    }

    await this.dependencies.mcpServerProfileService.ensureDefaultMcpServersForUser(
      options.user.id,
    );

    const [
      principal,
      azureProjects,
      azureTenants,
      azureSelection,
      threads,
      workspaceMcpServerProfiles,
      skillDiscovery,
    ] = await Promise.all([
      resolveAzurePrincipalProfile(tokenResult, azureDependencies),
      azureProjectQueryService.loadAzureProjectsWithFallback(
        options.request,
        tokenResult.token,
      ),
      azureProjectQueryService.loadAzureTenantsWithFallback(
        options.request,
        tokenResult.token,
        tokenResult.tenantId,
      ),
      this.dependencies.azureSelectionService.readStoredSelection({
        tenantId: options.user.tenantId,
        principalId: options.user.principalId,
      }),
      this.dependencies.threadQueryService.readUserThreads(options.user.id),
      this.dependencies.mcpServerProfileService.readWorkspaceMcpServerProfiles(
        options.user.id,
      ),
      this.dependencies.workspaceSkillService.discoverWorkspaceSkills({
        userId: options.user.id,
        forceRefresh: false,
      }),
    ]);

    const azureDeploymentsByProjectId = await loadAzureDeploymentsByProjectId(
      tokenResult.token,
      azureSelection,
    );

    return {
      tenantId: options.user.tenantId,
      principalId: options.user.principalId,
      principal,
      azureProjects,
      azureTenants,
      azureSelection,
      azureDeploymentsByProjectId,
      threads,
      workspaceMcpServerProfiles,
      skills: skillDiscovery.skills,
      skillRegistries: skillDiscovery.registries,
      skillWarnings: skillDiscovery.skillWarnings,
      registryWarnings: skillDiscovery.registryWarnings,
      warnings: skillDiscovery.warnings,
      desktopStatus: null,
    };
  }
}

export function createWorkspaceBootstrapService(
  dependencies: WorkspaceBootstrapDependencies,
): WorkspaceBootstrapService {
  return new WorkspaceBootstrapService(dependencies);
}

async function loadAzureDeploymentsByProjectId(
  accessToken: string,
  selection: AzureSelectionPreference | null,
): Promise<Record<string, AzureDeployment[]>> {
  const selectedProjectIds = [
    selection?.playground?.projectId ?? "",
    selection?.utility?.projectId ?? "",
  ].filter((projectId) => projectId.trim().length > 0);

  const uniqueProjectIds = [...new Set(selectedProjectIds)];
  if (uniqueProjectIds.length === 0) {
    return {};
  }

  const deployments = await Promise.all(
    uniqueProjectIds.map(async (projectId) => {
      const projectRef = parseProjectId(projectId);
      if (!projectRef) {
        return [projectId, []] as const;
      }

      try {
        const items = await azureProjectQueryService.listProjectDeployments(
          accessToken,
          projectRef,
        );
        return [projectId, items] as const;
      } catch {
        return [projectId, []] as const;
      }
    }),
  );

  return Object.fromEntries(deployments);
}
