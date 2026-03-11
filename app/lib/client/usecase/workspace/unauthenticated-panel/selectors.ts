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
