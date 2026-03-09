import type {
  AzureDeploymentResource,
  AzurePrincipalProfileResource,
  AzureProjectResource,
  AzureSelectionPreferenceResource,
  AzureSelectionTargetPreferenceResource,
  AzureTenantResource,
  AzureUtilitySelectionTargetPreferenceResource,
} from "~/lib/contracts/api/azure";
import type { AzureSelectionPreference } from "~/lib/domain/entities/azure-selection-preference";
import type { AzurePrincipalProfile } from "~/lib/domain/repositories/azure-arm-access-gateway";
import type {
  AzureDeployment,
  AzureProject,
  AzureTenant,
} from "~/lib/server/usecase/azure/azure-project-service";

export function presentAzurePrincipalProfileResource(
  principal: AzurePrincipalProfile | null,
): AzurePrincipalProfileResource | null {
  if (!principal) {
    return null;
  }

  return {
    tenantId: principal.tenantId,
    principalId: principal.principalId,
    displayName: principal.displayName,
    principalName: principal.principalName,
    principalType: principal.principalType,
  };
}

export function presentAzureProjectResources(
  projects: AzureProject[],
): AzureProjectResource[] {
  return projects.map((project) => ({
    id: project.id,
    projectName: project.projectName,
    baseUrl: project.baseUrl,
    apiVersion: project.apiVersion,
  }));
}

export function presentAzureDeploymentResources(
  deployments: AzureDeployment[],
): AzureDeploymentResource[] {
  return deployments.map((deployment) => ({
    name: deployment.name,
    reasoningEffortOptions: [...deployment.reasoningEffortOptions],
  }));
}

export function presentAzureTenantResources(
  tenants: AzureTenant[],
): AzureTenantResource[] {
  return tenants.map((tenant) => ({
    tenantId: tenant.tenantId,
    displayName: tenant.displayName,
    defaultDomain: tenant.defaultDomain,
  }));
}

export function presentAzureDeploymentsByProjectIdResource(
  deploymentsByProjectId: Record<string, AzureDeployment[]>,
): Record<string, AzureDeploymentResource[]> {
  return Object.fromEntries(
    Object.entries(deploymentsByProjectId).map(([projectId, deployments]) => [
      projectId,
      presentAzureDeploymentResources(deployments),
    ]),
  );
}

export function presentAzureSelectionPreferenceResource(
  selection: AzureSelectionPreference | null,
): AzureSelectionPreferenceResource | null {
  if (!selection) {
    return null;
  }

  return {
    tenantId: selection.tenantId,
    principalId: selection.principalId,
    theme: selection.theme,
    playground: presentAzureSelectionTargetPreferenceResource(
      selection.playground,
    ),
    utility: presentAzureUtilitySelectionTargetPreferenceResource(
      selection.utility,
    ),
  };
}

function presentAzureSelectionTargetPreferenceResource(
  target: {
    projectId: string;
    deploymentName: string;
  } | null,
): AzureSelectionTargetPreferenceResource | null {
  if (!target) {
    return null;
  }

  return {
    projectId: target.projectId,
    deploymentName: target.deploymentName,
  };
}

function presentAzureUtilitySelectionTargetPreferenceResource(
  target: {
    projectId: string;
    deploymentName: string;
    reasoningEffort: AzureUtilitySelectionTargetPreferenceResource["reasoningEffort"];
  } | null,
): AzureUtilitySelectionTargetPreferenceResource | null {
  if (!target) {
    return null;
  }

  return {
    projectId: target.projectId,
    deploymentName: target.deploymentName,
    reasoningEffort: target.reasoningEffort,
  };
}
