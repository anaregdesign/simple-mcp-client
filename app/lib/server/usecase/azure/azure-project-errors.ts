export function readAzureProjectErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

export function isLikelyAzureAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return [
    "defaultazurecredential",
    "interactivebrowsercredential",
    "authenticationrequirederror",
    "automatic authentication has been disabled",
    "chainedtokencredential",
    "credentialunavailableerror",
    "managedidentitycredential",
    "azure credential failed",
    "authentication",
    "authorization",
    "unauthorized",
    "forbidden",
    "access token",
    "aadsts",
  ].some((pattern) => message.includes(pattern));
}
