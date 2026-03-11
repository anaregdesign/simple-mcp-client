export type SkillRuntimeResourceFileEntry = {
  path: string;
  sizeBytes: number;
};

export type ActiveSkillRuntimeEntry = {
  name: string;
  description: string;
  location: string;
  guidePreloadRequested: boolean;
  preloadedGuideErrorMessage: string | null;
  preloadedGuideMarkdown: string | null;
  skillRoot: string;
  scripts: SkillRuntimeResourceFileEntry[];
  references: SkillRuntimeResourceFileEntry[];
  assets: SkillRuntimeResourceFileEntry[];
  scriptsTruncated: boolean;
  referencesTruncated: boolean;
  assetsTruncated: boolean;
};

export type SkillRuntimeContext = {
  activeSkills: ActiveSkillRuntimeEntry[];
  warnings: string[];
};
