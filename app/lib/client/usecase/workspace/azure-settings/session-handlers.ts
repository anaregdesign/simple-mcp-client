import {
  createAzureSessionOperations,
} from "./session-operations";
import type {
  AzureSettingsHandlerDependencies,
  AzureSettingsHandlers,
} from "./types";

type AzureSessionHandlers = Pick<
  AzureSettingsHandlers,
  | "handleAzureLogin"
  | "handleAzureTenantChange"
  | "handleAzureLogout"
  | "handleReloadAzureCatalog"
>;

type AzureSessionCatalogHandlers = Pick<AzureSettingsHandlers, "loadAzureProjects">;

export function createAzureSessionHandlers(
  deps: AzureSettingsHandlerDependencies,
  catalogHandlers: AzureSessionCatalogHandlers,
): AzureSessionHandlers {
  const operations = createAzureSessionOperations(deps, catalogHandlers);

  return {
    handleAzureLogin: operations.handleAzureLogin,
    handleAzureTenantChange: operations.handleAzureTenantChange,
    handleAzureLogout: operations.handleAzureLogout,
    handleReloadAzureCatalog: operations.handleReloadAzureCatalog,
  };
}
