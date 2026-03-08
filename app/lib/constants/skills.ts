/**
 * Impact scope:
 * These constants define Agent Skills discovery and runtime activation limits.
 * Changing them affects SKILL.md validation and chat-time Skill loading behavior.
 */
export const AGENT_SKILLS_DIRECTORY_NAME = "skills";
export const AGENT_SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const AGENT_SKILL_NAME_MAX_LENGTH = 64;
export const AGENT_SKILL_DESCRIPTION_MAX_LENGTH = 1_024;
export const AGENT_SKILL_FILE_MAX_BYTES = 1_000_000;
export const CHAT_MAX_ACTIVE_SKILLS = 24;
export const AGENT_SKILL_SCRIPTS_DIRECTORY_NAME = "scripts";
export const AGENT_SKILL_REFERENCES_DIRECTORY_NAME = "references";
export const AGENT_SKILL_ASSETS_DIRECTORY_NAME = "assets";
export const AGENT_SKILL_RESOURCES_DIRECTORY_NAME = "resources";
export const AGENT_SKILL_RESOURCE_MAX_FILES_PER_DIRECTORY = 200;
export const AGENT_SKILL_RESOURCE_PATH_MAX_LENGTH = 512;
export const AGENT_SKILL_PROMPT_RESOURCE_PREVIEW_MAX_FILES = 24;
export const AGENT_SKILL_TOOL_RESOURCE_PREVIEW_MAX_FILES = 80;
export const AGENT_SKILL_REFERENCE_FILE_MAX_BYTES = 1_000_000;
export const AGENT_SKILL_ASSET_FILE_MAX_BYTES = 2_000_000;
export const AGENT_SKILL_READ_TEXT_DEFAULT_MAX_CHARS = 12_000;
export const AGENT_SKILL_READ_TEXT_MAX_CHARS = 60_000;
export const AGENT_SKILL_SCRIPT_MAX_ARGS = 32;
export const AGENT_SKILL_SCRIPT_ARG_MAX_LENGTH = 512;
export const AGENT_SKILL_SCRIPT_TIMEOUT_MS = 20_000;
export const AGENT_SKILL_SCRIPT_TIMEOUT_MAX_MS = 120_000;
export const AGENT_SKILL_SCRIPT_OUTPUT_MAX_CHARS = 24_000;
export const SKILL_REGISTRY_LIST_CACHE_TTL_MS = 30_000;
export const SKILL_REGISTRY_TREE_CACHE_TTL_MS = 60_000;
export const CLIENT_SKILLS_RELOAD_MIN_INTERVAL_MS = 2_000;
export const DEFAULT_SKILL_REGISTRY_OPTIONS = [
  {
    id: "openai_curated",
    label: "OpenAI Curated",
    description: "Official curated Skill registry from openai/skills.",
    repository: "openai/skills",
    ref: "main",
    sourcePath: "skills/.curated",
    sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated",
    installDirectoryName: "openai-curated",
    skillPathLayout: "flat",
  },
  {
    id: "anthropic_public",
    label: "Anthropic Public",
    description: "Public Skill registry from anthropics/skills.",
    repository: "anthropics/skills",
    ref: "main",
    sourcePath: "skills",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills",
    installDirectoryName: "anthropic-public",
    skillPathLayout: "flat",
  },
  {
    id: "anaregdesign_public",
    label: "Anaregdesign Public",
    description: "Public tagged Skill registry from anaregdesign/skills.",
    repository: "anaregdesign/skills",
    ref: "main",
    sourcePath: "skills",
    sourceUrl: "https://github.com/anaregdesign/skills/tree/main/skills",
    installDirectoryName: "anaregdesign-public",
    skillPathLayout: "tagged",
  },
] as const;
