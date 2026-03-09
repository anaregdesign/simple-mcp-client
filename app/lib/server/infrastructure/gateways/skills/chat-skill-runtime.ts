import path from "node:path";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import {
  readSkillFrontmatter,
  readSkillMarkdown,
} from "~/lib/server/infrastructure/gateways/skills/skill-catalog";
import {
  inspectSkillResourceManifest,
} from "~/lib/server/infrastructure/gateways/skills/skill-runtime";
import type {
  ActiveSkillRuntimeEntry,
  SkillRuntimeContext,
} from "~/lib/server/usecase/chat/skill-runtime-types";

export type {
  ActiveSkillRuntimeEntry,
  SkillRuntimeContext,
} from "~/lib/server/usecase/chat/skill-runtime-types";

export async function buildSkillRuntimeContext(
  selectedSkills: ThreadSkillActivation[],
  options: {
    explicitSkillLocations?: string[];
  } = {},
): Promise<SkillRuntimeContext> {
  const warnings: string[] = [];
  if (selectedSkills.length === 0) {
    return {
      activeSkills: [],
      warnings,
    };
  }

  const explicitSkillLocationSet = new Set(
    [
      ...selectedSkills.map((skill) => skill.location),
      ...(options.explicitSkillLocations ?? []),
    ]
      .map((location) => location.trim())
      .filter((location) => location.length > 0),
  );
  const activeSkills: ActiveSkillRuntimeEntry[] = [];
  for (const selectedSkill of selectedSkills) {
    try {
      const frontmatter = await readSkillFrontmatter(selectedSkill.location);
      const shouldPreloadGuide = explicitSkillLocationSet.has(
        selectedSkill.location,
      );
      let preloadedGuideMarkdown: string | null = null;
      let preloadedGuideErrorMessage: string | null = null;
      if (shouldPreloadGuide) {
        try {
          preloadedGuideMarkdown = await readSkillMarkdown(
            selectedSkill.location,
          );
        } catch (error) {
          preloadedGuideErrorMessage = readErrorMessage(error);
          warnings.push(
            `Failed to preload full Skill guide for ${frontmatter.name}: ${preloadedGuideErrorMessage}`,
          );
        }
      }

      const resources = await inspectSkillResourceManifest(
        selectedSkill.location,
      ).catch((error) => {
        warnings.push(
          `Failed to inspect Skill resources for ${frontmatter.name}: ${readErrorMessage(error)}`,
        );
        return buildEmptySkillResourceManifest(selectedSkill.location);
      });

      activeSkills.push({
        name: frontmatter.name,
        description: frontmatter.description,
        location: selectedSkill.location,
        guidePreloadRequested: shouldPreloadGuide,
        preloadedGuideErrorMessage,
        preloadedGuideMarkdown,
        skillRoot: resources.skillRoot,
        scripts: resources.scripts,
        references: resources.references,
        assets: resources.assets,
        scriptsTruncated: resources.scriptsTruncated,
        referencesTruncated: resources.referencesTruncated,
        assetsTruncated: resources.assetsTruncated,
      });
    } catch (error) {
      warnings.push(
        `Failed to load Skill ${selectedSkill.name}: ${readErrorMessage(error)}`,
      );
    }
  }

  return {
    activeSkills,
    warnings,
  };
}

export function collectSkillRuntimeWarnings(runtime: SkillRuntimeContext): string[] {
  return runtime.warnings
    .map((warning) => warning.trim())
    .filter((warning) => warning.length > 0);
}

function buildEmptySkillResourceManifest(
  skillLocation: string,
): ReturnType<typeof buildSkillResourceManifestFallback> {
  return buildSkillResourceManifestFallback(path.dirname(skillLocation));
}

function buildSkillResourceManifestFallback(skillRoot: string) {
  return {
    skillRoot,
    scripts: [],
    references: [],
    assets: [],
    scriptsTruncated: false,
    referencesTruncated: false,
    assetsTruncated: false,
  };
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
