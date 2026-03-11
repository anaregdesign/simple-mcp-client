import type {
  ReconcileWorkspaceSkillProfilesData,
  WorkspaceSkillProfileResource,
  WorkspaceSkillProfilesData as WorkspaceSkillProfilesResponseData,
  WorkspaceSkillRegistryProfileResource,
} from "~/lib/contracts/skills/workspace-skill-profiles";
import type {
  SyncWorkspaceSkillMastersResult,
  WorkspaceSkillProfile,
  WorkspaceSkillProfilesData,
  WorkspaceSkillRegistryProfile,
} from "~/lib/domain/repositories/workspace-skill-profile-repository";
import type { SkillDiscoveryResult } from "~/lib/server/usecase/skills/workspace-skill-service";

export function presentWorkspaceSkillProfilesData(
  data: WorkspaceSkillProfilesData,
): WorkspaceSkillProfilesResponseData {
  return {
    workspaceSkillProfiles: data.workspaceSkillProfiles.map(
      presentWorkspaceSkillProfileResource,
    ),
    workspaceSkillRegistryProfiles: data.workspaceSkillRegistryProfiles.map(
      presentWorkspaceSkillRegistryProfileResource,
    ),
  };
}

export function presentReconcileWorkspaceSkillProfilesData(options: {
  discovery: SkillDiscoveryResult;
  sync: SyncWorkspaceSkillMastersResult;
  profilesData: WorkspaceSkillProfilesData;
}): ReconcileWorkspaceSkillProfilesData {
  const profilesData = presentWorkspaceSkillProfilesData(options.profilesData);

  return {
    message: "Workspace Skill profiles reconciled from installed Skills.",
    skills: options.discovery.skills,
    skillRegistries: options.discovery.registries,
    skillWarnings: options.discovery.skillWarnings,
    registryWarnings: options.discovery.registryWarnings,
    warnings: options.discovery.warnings,
    workspaceSkillProfileCount: options.sync.workspaceSkillProfileCount,
    workspaceSkillRegistryProfileCount:
      options.sync.workspaceSkillRegistryProfileCount,
    workspaceSkillProfiles: profilesData.workspaceSkillProfiles,
    workspaceSkillRegistryProfiles: profilesData.workspaceSkillRegistryProfiles,
  };
}

function presentWorkspaceSkillProfileResource(
  profile: WorkspaceSkillProfile,
): WorkspaceSkillProfileResource {
  return {
    id: profile.id,
    userId: profile.userId,
    registryProfileId: profile.registryProfileId,
    name: profile.name,
    location: profile.location,
    source: profile.source,
  };
}

function presentWorkspaceSkillRegistryProfileResource(
  profile: WorkspaceSkillRegistryProfile,
): WorkspaceSkillRegistryProfileResource {
  return {
    id: profile.id,
    userId: profile.userId,
    registryId: profile.registryId,
    registryLabel: profile.registryLabel,
    registryDescription: profile.registryDescription,
    repository: profile.repository,
    repositoryUrl: profile.repositoryUrl,
    sourcePath: profile.sourcePath,
    installDirectoryName: profile.installDirectoryName,
  };
}
