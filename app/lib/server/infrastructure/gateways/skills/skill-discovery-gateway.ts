import { discoverSkillCatalog } from "~/lib/server/skills/catalog";
import { discoverSkillRegistries } from "~/lib/server/skills/registry";

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
