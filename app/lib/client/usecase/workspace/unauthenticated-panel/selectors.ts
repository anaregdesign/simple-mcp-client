type Callback = (...args: any[]) => void | Promise<void>;

export function buildUnauthenticatedPanelProps(options: {
  isStartingAzureLogin: boolean;
  onAzureLogin: Callback;
}) {
  return {
    isStartingAzureLogin: options.isStartingAzureLogin,
    onAzureLogin: options.onAzureLogin,
  };
}

export function shouldShowAzureAuthPendingPanel(options: {
  isLoadingAzureConnections: boolean;
  isAzureAuthRequired: boolean;
  activeAzurePrincipal: object | null;
  azureConnectionCount: number;
  azureConnectionError: string | null;
}) {
  if (options.isAzureAuthRequired) {
    return false;
  }

  if (!options.isLoadingAzureConnections) {
    return false;
  }

  if (options.activeAzurePrincipal !== null) {
    return false;
  }

  if (options.azureConnectionCount > 0) {
    return false;
  }

  return options.azureConnectionError === null;
}
