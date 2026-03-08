import type { SkillRegistryCatalog } from "~/lib/contracts/skills/types";
import type { SkillRegistryOption } from "~/lib/contracts/skills/registry";
import { DomainError } from "~/lib/domain/shared/domain-error";

export type WorkspaceSkillRegistryProfileSnapshot = {
  id: number;
  registryId: string;
  registryLabel: string;
  registryDescription: string;
  repository: string;
  repositoryUrl: string;
  sourcePath: string;
  installDirectoryName: string;
};

type WorkspaceSkillRegistryProfileInput = Omit<WorkspaceSkillRegistryProfileSnapshot, "id"> & {
  id?: number | null;
};

export class WorkspaceSkillRegistryProfile {
  readonly id: number | null;
  readonly registryId: string;
  readonly registryLabel: string;
  readonly registryDescription: string;
  readonly repository: string;
  readonly repositoryUrl: string;
  readonly sourcePath: string;
  readonly installDirectoryName: string;

  constructor(snapshot: WorkspaceSkillRegistryProfileInput) {
    const registryId = snapshot.registryId.trim();
    const registryLabel = snapshot.registryLabel.trim();
    const repository = snapshot.repository.trim();
    const repositoryUrl = snapshot.repositoryUrl.trim();
    const sourcePath = snapshot.sourcePath.trim();
    const installDirectoryName = snapshot.installDirectoryName.trim();

    if (snapshot.id !== undefined && snapshot.id !== null) {
      if (!Number.isInteger(snapshot.id) || snapshot.id <= 0) {
        throw new DomainError(
          "workspace_skill_registry_profile_id_invalid",
          "WorkspaceSkillRegistryProfile id must be a positive integer.",
        );
      }
    }
    if (!registryId) {
      throw new DomainError(
        "workspace_skill_registry_profile_registry_id_required",
        "WorkspaceSkillRegistryProfile registryId is required.",
      );
    }
    if (!registryLabel) {
      throw new DomainError(
        "workspace_skill_registry_profile_label_required",
        "WorkspaceSkillRegistryProfile registryLabel is required.",
      );
    }
    if (!repository) {
      throw new DomainError(
        "workspace_skill_registry_profile_repository_required",
        "WorkspaceSkillRegistryProfile repository is required.",
      );
    }
    if (!repositoryUrl) {
      throw new DomainError(
        "workspace_skill_registry_profile_repository_url_required",
        "WorkspaceSkillRegistryProfile repositoryUrl is required.",
      );
    }
    if (!sourcePath) {
      throw new DomainError(
        "workspace_skill_registry_profile_source_path_required",
        "WorkspaceSkillRegistryProfile sourcePath is required.",
      );
    }
    if (!installDirectoryName) {
      throw new DomainError(
        "workspace_skill_registry_profile_install_directory_required",
        "WorkspaceSkillRegistryProfile installDirectoryName is required.",
      );
    }

    this.id = snapshot.id ?? null;
    this.registryId = registryId;
    this.registryLabel = registryLabel;
    this.registryDescription = snapshot.registryDescription.trim();
    this.repository = repository;
    this.repositoryUrl = repositoryUrl;
    this.sourcePath = sourcePath;
    this.installDirectoryName = installDirectoryName;
  }

  static fromSnapshot(
    snapshot: WorkspaceSkillRegistryProfileSnapshot,
  ): WorkspaceSkillRegistryProfile {
    return new WorkspaceSkillRegistryProfile(snapshot);
  }

  static fromCatalog(
    catalog: SkillRegistryCatalog,
    option: SkillRegistryOption,
  ): WorkspaceSkillRegistryProfile {
    return new WorkspaceSkillRegistryProfile({
      registryId: catalog.registryId,
      registryLabel: catalog.registryLabel,
      registryDescription: catalog.registryDescription,
      repository: catalog.repository,
      repositoryUrl: catalog.repositoryUrl,
      sourcePath: catalog.sourcePath,
      installDirectoryName: option.installDirectoryName,
    });
  }

  toPersistenceRecord(userId: number): {
    userId: number;
    registryId: string;
    registryLabel: string;
    registryDescription: string;
    repository: string;
    repositoryUrl: string;
    sourcePath: string;
    installDirectoryName: string;
  } {
    return {
      userId,
      registryId: this.registryId,
      registryLabel: this.registryLabel,
      registryDescription: this.registryDescription,
      repository: this.repository,
      repositoryUrl: this.repositoryUrl,
      sourcePath: this.sourcePath,
      installDirectoryName: this.installDirectoryName,
    };
  }

  toSnapshot(): WorkspaceSkillRegistryProfileSnapshot {
    if (this.id === null) {
      throw new DomainError(
        "workspace_skill_registry_profile_id_missing",
        "WorkspaceSkillRegistryProfile id is required for snapshot serialization.",
      );
    }

    return {
      id: this.id,
      registryId: this.registryId,
      registryLabel: this.registryLabel,
      registryDescription: this.registryDescription,
      repository: this.repository,
      repositoryUrl: this.repositoryUrl,
      sourcePath: this.sourcePath,
      installDirectoryName: this.installDirectoryName,
    };
  }

  toJSON(): WorkspaceSkillRegistryProfileSnapshot {
    return this.toSnapshot();
  }
}
