import nodeOs from "node:os";
import type { AzurePrincipalType } from "~/lib/domain/value-objects/azure-principal-type";
import {
  readAzureArmUserContext,
} from "~/lib/server/infrastructure/auth/azure-arm-user-context";
import {
  readLatestThreadNameForInstruction,
  readPlaygroundSelectionForInstruction,
  resolveThreadDirectoryPath,
} from "~/lib/server/infrastructure/gateways/chat/thread-directory-context";
import type {
  ChatExecutionOptions,
  InstructionSystemContextPayload,
} from "~/lib/server/usecase/chat/chat-execution";

type InstructionClientOperatingSystemContext = {
  name: string;
  version: string | null;
  source: "sec-ch-ua-platform" | "user-agent" | "unknown";
};

type InstructionServerOperatingSystemContext = {
  name: string;
  platform: NodeJS.Platform;
  release: string;
  architecture: string;
};

export async function buildSystemInstructionContextPayload(
  options: ChatExecutionOptions,
): Promise<InstructionSystemContextPayload> {
  const clientOperatingSystem = buildInstructionClientOperatingSystemContext(
    options.clientPlatform,
    options.clientUserAgent,
  );
  const serverOperatingSystem = buildInstructionServerOperatingSystemContext();
  const basePayload: InstructionSystemContextPayload = {
    userContext: {
      userId: null,
      workspaceDirectoryPath: null,
    },
    threadContext: {
      threadId: options.threadId,
      turnId: options.turnId,
    },
    systemContext: {
      clientOperatingSystem,
      serverOperatingSystem,
    },
    latestThreadName: null,
    azureContext: {
      principalDisplayName: null,
      principalName: null,
      principalType: "Unknown",
      tenantId: normalizeOptionalInstructionLabel(options.azureConfig.tenantId),
      principalId: null,
      playgroundProject: normalizeOptionalInstructionLabel(
        options.azureConfig.projectName,
      ),
      playgroundProjectId: null,
      playgroundDeployment: normalizeOptionalInstructionLabel(
        options.azureConfig.deploymentName,
      ),
      endpoint: normalizeOptionalInstructionLabel(options.azureConfig.baseUrl),
      apiVersion: normalizeOptionalInstructionLabel(
        options.azureConfig.apiVersion,
      ),
    },
  };

  const azureContext = await readAzureArmUserContext(
    undefined,
    options.azureConfig.tenantId,
  );
  if (!azureContext) {
    return basePayload;
  }

  const payload: InstructionSystemContextPayload = {
    ...basePayload,
    azureContext: {
      ...basePayload.azureContext,
      principalDisplayName: normalizeOptionalInstructionLabel(
        azureContext.displayName,
      ),
      principalName: normalizeOptionalInstructionLabel(
        azureContext.principalName,
      ),
      principalType: formatInstructionPrincipalType(azureContext.principalType),
      tenantId: normalizeOptionalInstructionLabel(azureContext.tenantId),
      principalId: normalizeOptionalInstructionLabel(azureContext.principalId),
    },
  };

  try {
    const userId = options.userId;
    if (userId === null) {
      return payload;
    }

    payload.userContext = {
      userId,
      workspaceDirectoryPath: resolveThreadDirectoryPath({
        userId,
        threadId: options.threadId,
      }),
    };

    const [latestThreadName, selection] = await Promise.all([
      readLatestThreadNameForInstruction(userId),
      readPlaygroundSelectionForInstruction(userId),
    ]);
    payload.latestThreadName = latestThreadName;
    payload.azureContext = {
      ...payload.azureContext,
      playgroundProjectId: selection.projectId,
      playgroundDeployment:
        payload.azureContext.playgroundDeployment ?? selection.deploymentName,
    };
  } catch {
    // Best-effort enrichment only; chat execution should not fail when metadata is unavailable.
  }

  return payload;
}

function normalizeOptionalInstructionLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function formatInstructionPrincipalType(
  principalType: AzurePrincipalType,
): "User" | "Service Principal" | "Managed Identity" | "Unknown" {
  if (principalType === "user") {
    return "User";
  }
  if (principalType === "servicePrincipal") {
    return "Service Principal";
  }
  if (principalType === "managedIdentity") {
    return "Managed Identity";
  }
  return "Unknown";
}

function buildInstructionClientOperatingSystemContext(
  clientPlatform: string | null,
  clientUserAgent: string | null,
): InstructionClientOperatingSystemContext {
  const normalizedPlatform = normalizeOptionalInstructionLabel(clientPlatform);
  if (normalizedPlatform) {
    return {
      name: normalizeInstructionClientHintPlatform(normalizedPlatform),
      version: null,
      source: "sec-ch-ua-platform",
    };
  }

  const normalizedUserAgent =
    normalizeOptionalInstructionLabel(clientUserAgent);
  if (!normalizedUserAgent) {
    return {
      name: "Unknown",
      version: null,
      source: "unknown",
    };
  }

  const parsedFromUserAgent =
    parseInstructionOperatingSystemFromUserAgent(normalizedUserAgent);
  if (!parsedFromUserAgent) {
    return {
      name: "Unknown",
      version: null,
      source: "unknown",
    };
  }

  return {
    ...parsedFromUserAgent,
    source: "user-agent",
  };
}

function parseInstructionOperatingSystemFromUserAgent(
  userAgent: string,
): Omit<InstructionClientOperatingSystemContext, "source"> | null {
  const lowerUserAgent = userAgent.toLowerCase();

  if (lowerUserAgent.includes("windows nt")) {
    return {
      name: "Windows",
      version: normalizeInstructionOperatingSystemVersion(
        extractInstructionUserAgentVersion(userAgent, /Windows NT ([0-9.]+)/i),
      ),
    };
  }

  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return {
      name: "iOS",
      version: normalizeInstructionOperatingSystemVersion(
        extractInstructionUserAgentVersion(userAgent, /OS ([0-9_]+)/i),
      ),
    };
  }

  if (lowerUserAgent.includes("android")) {
    return {
      name: "Android",
      version: normalizeInstructionOperatingSystemVersion(
        extractInstructionUserAgentVersion(userAgent, /Android ([0-9.]+)/i),
      ),
    };
  }

  if (
    lowerUserAgent.includes("mac os x") ||
    lowerUserAgent.includes("macintosh")
  ) {
    return {
      name: "macOS",
      version: normalizeInstructionOperatingSystemVersion(
        extractInstructionUserAgentVersion(userAgent, /Mac OS X ([0-9_]+)/i),
      ),
    };
  }

  if (lowerUserAgent.includes("linux")) {
    return {
      name: "Linux",
      version: null,
    };
  }

  return null;
}

function extractInstructionUserAgentVersion(
  userAgent: string,
  pattern: RegExp,
): string | null {
  const matched = userAgent.match(pattern);
  const version = matched?.[1];
  if (typeof version !== "string") {
    return null;
  }

  const normalized = version.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeInstructionOperatingSystemVersion(
  value: string | null,
): string | null {
  if (!value) {
    return null;
  }

  return value.replaceAll("_", ".");
}

function normalizeInstructionClientHintPlatform(value: string): string {
  const unquoted = value
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .trim();
  return unquoted.length > 0 ? unquoted : "Unknown";
}

function buildInstructionServerOperatingSystemContext(): InstructionServerOperatingSystemContext {
  const platform = process.platform;
  return {
    name: mapInstructionNodePlatformToOperatingSystemName(platform),
    platform,
    release: nodeOs.release(),
    architecture: nodeOs.arch(),
  };
}

function mapInstructionNodePlatformToOperatingSystemName(
  platform: NodeJS.Platform,
): string {
  if (platform === "darwin") {
    return "macOS";
  }
  if (platform === "win32") {
    return "Windows";
  }
  if (platform === "linux") {
    return "Linux";
  }
  return platform;
}
