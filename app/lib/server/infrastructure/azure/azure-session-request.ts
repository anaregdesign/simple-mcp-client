import { readJsonPayload } from "~/lib/server/infrastructure/http/route-transport";

const AZURE_SESSION_INVALID_BODY_ERROR = "Invalid request body.";

export async function readAzureSessionPutTenantId(
  request: Request,
): Promise<{ ok: true; tenantId: string } | { ok: false; error: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: true, tenantId: "" };
  }

  const payload = await readJsonPayload(request);
  if (!payload.ok || !isRecord(payload.value)) {
    return { ok: false, error: AZURE_SESSION_INVALID_BODY_ERROR };
  }

  const tenantId =
    typeof payload.value.tenantId === "string"
      ? payload.value.tenantId.trim()
      : "";
  return { ok: true, tenantId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
