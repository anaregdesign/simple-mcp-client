/**
 * Server runtime module.
 */
export type WebSearchPreviewUserLocation = {
  type: "approximate";
  country: string;
};

const BCP47_REGION_CODE_PATTERN = /^[A-Za-z]{2}$/;

export function wantsEventStream(request: Request): boolean {
  const acceptHeader = request.headers.get("accept");
  return (
    typeof acceptHeader === "string" &&
    acceptHeader.toLowerCase().includes("text/event-stream")
  );
}

export function readOptionalRequestHeaderValue(
  request: Request,
  headerName: string,
): string | null {
  const rawValue = request.headers.get(headerName);
  if (typeof rawValue !== "string") {
    return null;
  }

  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : null;
}

export function readWebSearchUserLocationFromRequest(
  request: Request,
): WebSearchPreviewUserLocation | null {
  const acceptLanguage = readOptionalRequestHeaderValue(request, "accept-language");
  if (!acceptLanguage) {
    return null;
  }

  const primaryLanguageRange = acceptLanguage.split(",")[0]?.trim() ?? "";
  if (!primaryLanguageRange) {
    return null;
  }

  const primaryLanguageTag = primaryLanguageRange.split(";")[0]?.trim() ?? "";
  if (!primaryLanguageTag) {
    return null;
  }

  const regionCode = readRegionCodeFromLanguageTag(primaryLanguageTag);
  if (!regionCode) {
    return null;
  }

  return {
    type: "approximate",
    country: regionCode,
  };
}

export function readRegionCodeFromLanguageTag(languageTag: string): string | null {
  const parts = languageTag.split("-");
  if (parts.length < 2) {
    return null;
  }

  const regionCandidate = parts[parts.length - 1]?.trim();
  if (!regionCandidate || !BCP47_REGION_CODE_PATTERN.test(regionCandidate)) {
    return null;
  }

  return regionCandidate.toUpperCase();
}
