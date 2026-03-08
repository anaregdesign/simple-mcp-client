import type { SkillCatalogSource } from "~/lib/contracts/skills/types";
import { DomainError } from "~/lib/domain/shared/domain-error";

export type WorkspaceSkillProfileSnapshot = {
  id: number;
  registryProfileId: number | null;
  name: string;
  location: string;
  source: SkillCatalogSource;
};

export class WorkspaceSkillProfile {
  readonly id: number;
  readonly registryProfileId: number | null;
  readonly name: string;
  readonly location: string;
  readonly source: SkillCatalogSource;

  constructor(snapshot: WorkspaceSkillProfileSnapshot) {
    const name = snapshot.name.trim();
    const location = snapshot.location.trim();
    if (!Number.isInteger(snapshot.id) || snapshot.id <= 0) {
      throw new DomainError(
        "workspace_skill_profile_id_invalid",
        "WorkspaceSkillProfile id must be a positive integer.",
      );
    }
    if (!name) {
      throw new DomainError(
        "workspace_skill_profile_name_required",
        "WorkspaceSkillProfile name is required.",
      );
    }
    if (!location) {
      throw new DomainError(
        "workspace_skill_profile_location_required",
        "WorkspaceSkillProfile location is required.",
      );
    }

    this.id = snapshot.id;
    this.registryProfileId =
      typeof snapshot.registryProfileId === "number" ? snapshot.registryProfileId : null;
    this.name = name;
    this.location = location;
    this.source = snapshot.source;
  }

  static fromSnapshot(snapshot: WorkspaceSkillProfileSnapshot): WorkspaceSkillProfile {
    return new WorkspaceSkillProfile(snapshot);
  }

  hasRegistryProfile(): boolean {
    return this.registryProfileId !== null;
  }

  toSnapshot(): WorkspaceSkillProfileSnapshot {
    return {
      id: this.id,
      registryProfileId: this.registryProfileId,
      name: this.name,
      location: this.location,
      source: this.source,
    };
  }

  toJSON(): WorkspaceSkillProfileSnapshot {
    return this.toSnapshot();
  }
}
