/**
 * Shared Azure project service for API routes.
 */
import {
  getArmAccessToken,
  isLikelyAzureAuthError,
  listProjectDeployments,
  parseProjectId,
  readErrorMessage,
  resolveAzurePrincipalProfile,
} from "~/routes/api.azure.projects";

export {
  getArmAccessToken,
  isLikelyAzureAuthError,
  listProjectDeployments,
  parseProjectId,
  readErrorMessage,
  resolveAzurePrincipalProfile,
};
