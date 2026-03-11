import {
  THREAD_ENVIRONMENT_KEY_MAX_LENGTH,
  THREAD_ENVIRONMENT_KEY_PATTERN,
  THREAD_ENVIRONMENT_VALUE_MAX_LENGTH,
  THREAD_ENVIRONMENT_VARIABLES_MAX,
  type ThreadEnvironment,
} from "~/lib/domain/value-objects/thread-environment";

export function applySkillScriptEnvironmentChanges(
  threadEnvironment: ThreadEnvironment,
  changes: {
    captured: boolean;
    updated: Record<string, string>;
    removed: string[];
  },
): {
  captured: boolean;
  updated: string[];
  removed: string[];
  ignored: string[];
} {
  if (!changes.captured) {
    return {
      captured: false,
      updated: [],
      removed: [],
      ignored: [],
    };
  }

  const updatedKeys: string[] = [];
  const ignoredKeys: string[] = [];
  const removedKeys: string[] = [];
  for (const key of changes.removed) {
    if (!(key in threadEnvironment)) {
      continue;
    }

    delete threadEnvironment[key];
    removedKeys.push(key);
  }

  let threadEnvironmentEntryCount = Object.keys(threadEnvironment).length;
  for (const [key, value] of Object.entries(changes.updated)) {
    if (
      key.length > THREAD_ENVIRONMENT_KEY_MAX_LENGTH ||
      !THREAD_ENVIRONMENT_KEY_PATTERN.test(key) ||
      value.length > THREAD_ENVIRONMENT_VALUE_MAX_LENGTH
    ) {
      ignoredKeys.push(key);
      continue;
    }

    const alreadyExists = key in threadEnvironment;
    if (
      !alreadyExists &&
      threadEnvironmentEntryCount >= THREAD_ENVIRONMENT_VARIABLES_MAX
    ) {
      ignoredKeys.push(key);
      continue;
    }

    threadEnvironment[key] = value;
    if (!alreadyExists) {
      threadEnvironmentEntryCount += 1;
    }
    updatedKeys.push(key);
  }

  return {
    captured: true,
    updated: updatedKeys,
    removed: removedKeys,
    ignored: ignoredKeys,
  };
}
