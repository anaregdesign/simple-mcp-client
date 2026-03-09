import { discoverSkillCatalog } from "~/lib/server/infrastructure/gateways/skills/skill-catalog";
import { discoverSkillRegistries } from "~/lib/server/infrastructure/gateways/skills/skill-registry-gateway";

export async function discoverWorkspaceSkillCatalog(options: {
  workspaceUserId: number;
}) {
  return await discoverSkillCatalog(options);
}

export async function discoverWorkspaceSkillRegistries(options: {
  workspaceUserId: number;
  forceRefresh: boolean;
}) {
  return await discoverSkillRegistries(options);
}
