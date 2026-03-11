import {
  buildRegistryListCacheKey,
  buildRegistryTreeCacheKey,
  buildVersionChecksumFromBlobEntries,
  normalizeSkillName,
  readBlobEntriesFromTreePayload,
  readRegistrySkillPathFromBlobPath,
  readSkillNamesFromContentsPayload,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-remote";
import {
  isInstalledSkillMetadataCurrent,
  isSafeRelativePath,
  readInstalledSkillMetadataFromUnknown,
  resolveAppDataSkillsRoot,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-storage";

export const skillRegistryServerTestUtils = {
  normalizeSkillName,
  readSkillNamesFromContentsPayload,
  readBlobEntriesFromTreePayload,
  readRegistrySkillPathFromBlobPath,
  buildVersionChecksumFromBlobEntries,
  isInstalledSkillMetadataCurrent,
  readInstalledSkillMetadataFromUnknown,
  buildRegistryListCacheKey,
  buildRegistryTreeCacheKey,
  isSafeRelativePath,
  resolveAppDataSkillsRoot,
};
