import { parseProjectId } from "~/lib/contracts/api/azure-project-id";
import {
  type AzureArmAccessGateway,
  type AzurePrincipalProfile,
} from "~/lib/domain/repositories/azure-arm-access-gateway";
import type { WorkspaceMcpServerProfileResource as WorkspaceMcpServerProfile } from "~/lib/contracts/mcp/profile";
import type { AzureSelectionPreference } from "~/lib/domain/entities/azure-selection-preference";
import type { Thread } from "~/lib/domain/entities/thread";
import {
  type AzureProjectQueryService,
  type AzureDeployment,
  type AzureProject,
  type AzureTenant,
} from "~/lib/server/usecase/azure/azure-project-service";
import {
  type AzureSelectionService,
} from "~/lib/server/usecase/azure/azure-selection-service";
import {
  type McpServerProfileService,
} from "~/lib/server/usecase/mcp/mcp-server-profile-service";
import {
  type WorkspaceSkillService,
  type SkillDiscoveryResult,
} from "~/lib/server/usecase/skills/workspace-skill-service";
import { type ThreadQueryService } from "~/lib/server/usecase/threads/thread-service";

type WorkspaceBootstrapUser = {
  id: number;
  tenantId: string;
  principalId: string;
};

type WorkspaceBootstrapOptions = {
  user: WorkspaceBootstrapUser;
};

type WorkspaceBootstrapData = {
  tenantId: string;
  principalId: string;
  principal: AzurePrincipalProfile | null;
  azureProjects: AzureProject[];
  azureTenants: AzureTenant[];
  azureSelection: AzureSelectionPreference | null;
  azureDeploymentsByProjectId: Record<string, AzureDeployment[]>;
  threads: Thread[];
  workspaceMcpServerProfiles: WorkspaceMcpServerProfile[];
  skills: SkillDiscoveryResult["skills"];
  skillRegistries: SkillDiscoveryResult["registries"];
  skillWarnings: string[];
  registryWarnings: string[];
  warnings: string[];
};

type WorkspaceBootstrapDependencies = {
  azureArmAccessGateway: AzureArmAccessGateway;
  azureProjectQueryService: Pick<
    AzureProjectQueryService,
    "loadAzureProjectsWithFallback" | "loadAzureTenantsWithFallback" | "listProjectDeployments"
  >;
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
    const tokenResult = await this.dependencies.azureArmAccessGateway.getArmAccessToken();
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
      this.dependencies.azureArmAccessGateway.resolveAzurePrincipalProfile(tokenResult),
      this.dependencies.azureProjectQueryService.loadAzureProjectsWithFallback(
        tokenResult.token,
      ),
      this.dependencies.azureProjectQueryService.loadAzureTenantsWithFallback(
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
      this.dependencies.azureProjectQueryService,
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
    };
  }
}

export function createWorkspaceBootstrapService(
  dependencies: WorkspaceBootstrapDependencies,
): WorkspaceBootstrapService {
  return new WorkspaceBootstrapService(dependencies);
}

async function loadAzureDeploymentsByProjectId(
  azureProjectQueryServiceDependency: Pick<
    AzureProjectQueryService,
    "listProjectDeployments"
  >,
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
        const items = await azureProjectQueryServiceDependency.listProjectDeployments(
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
