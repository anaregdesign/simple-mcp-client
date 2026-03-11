export type AzureProjectRef = {
  subscriptionId: string;
  resourceGroup: string;
  accountName: string;
};

export function createProjectId(projectRef: AzureProjectRef): string {
  const raw = JSON.stringify(projectRef);
  return Buffer.from(raw, "utf8").toString("base64url");
}

export function parseProjectId(projectId: string): AzureProjectRef | null {
  try {
    const decoded = Buffer.from(projectId, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    const subscriptionId =
      typeof parsed.subscriptionId === "string"
        ? parsed.subscriptionId.trim()
        : "";
    const resourceGroup =
      typeof parsed.resourceGroup === "string"
        ? parsed.resourceGroup.trim()
        : "";
    const accountName =
      typeof parsed.accountName === "string" ? parsed.accountName.trim() : "";
    if (!subscriptionId || !resourceGroup || !accountName) {
      return null;
    }

    return { subscriptionId, resourceGroup, accountName };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
