import { getAzureDependencies } from "~/lib/server/infrastructure/azure/dependencies";
import {
  azureProjectQueryService,
  getArmAccessToken,
  parseProjectId,
  type AzureDeployment,
  type AzureProject,
  type AzureTenant,
} from "~/lib/server/application/azure/azure-project-service";
import {
  azureSelectionService,
  type AzureSelectionPreference,
} from "~/lib/server/application/azure/azure-selection-service";
import {
  mcpServerProfileService,
} from "~/lib/server/application/mcp/mcp-server-profile-service";
import {
  workspaceSkillService,
  type SkillDiscoveryResult,
} from "~/lib/server/application/skills/workspace-skill-service";
import { threadQueryService } from "~/lib/server/application/threads/thread-service";
import { getOrCreateUserByIdentity } from "~/lib/server/persistence/user";
import type { WorkspaceMcpServerProfileResource } from "~/lib/contracts/mcp/profile";
import type { ThreadResource } from "~/lib/contracts/threads/types";

type WorkspaceBootstrapOptions = {
  request: Request;
};

type WorkspaceBootstrapData = {
  tenantId: string;
  principalId: string;
  principal: Awaited<
    ReturnType<typeof azureProjectQueryService.resolveAzurePrincipalProfile>
  >;
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

export class WorkspaceBootstrapService {
  async loadWorkspaceBootstrap(
    options: WorkspaceBootstrapOptions,
  ): Promise<WorkspaceBootstrapData | null> {
    const dependencies = getAzureDependencies();
    const tokenResult = await getArmAccessToken(dependencies);
    if (!tokenResult.ok) {
      return null;
    }

    const user = await getOrCreateUserByIdentity({
      tenantId: tokenResult.tenantId,
      principalId: tokenResult.principalId,
    });

    await mcpServerProfileService.ensureDefaultMcpServersForUser(user.id);

    const [
      principal,
      azureProjects,
      azureTenants,
      azureSelection,
      threads,
      workspaceMcpServerProfiles,
      skillDiscovery,
    ] = await Promise.all([
      azureProjectQueryService.resolveAzurePrincipalProfile(tokenResult, dependencies),
      azureProjectQueryService.loadAzureProjectsWithFallback(options.request, tokenResult.token),
      azureProjectQueryService.loadAzureTenantsWithFallback(
        options.request,
        tokenResult.token,
        tokenResult.tenantId,
      ),
      azureSelectionService.readStoredSelection({
        tenantId: tokenResult.tenantId,
        principalId: tokenResult.principalId,
      }),
      threadQueryService.readUserThreads(user.id),
      mcpServerProfileService.readWorkspaceMcpServerProfiles(user.id),
      workspaceSkillService.discoverWorkspaceSkills({
        userId: user.id,
        forceRefresh: false,
      }),
    ]);

    const azureDeploymentsByProjectId = await loadAzureDeploymentsByProjectId(
      tokenResult.token,
      azureSelection,
    );

    return {
      tenantId: tokenResult.tenantId,
      principalId: tokenResult.principalId,
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

export const workspaceBootstrapService = new WorkspaceBootstrapService();

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
