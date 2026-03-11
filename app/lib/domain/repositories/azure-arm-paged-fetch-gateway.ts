export type AzureArmPagedFetchLogInput = {
  route: string;
  eventName: string;
  action: string;
  level?: "info" | "warning" | "error";
  statusCode?: number;
  message?: string;
  error?: unknown;
  context?: unknown;
};

export type AzureArmPagedFetchLogEvent = (
  input: AzureArmPagedFetchLogInput,
) => Promise<void>;

export interface AzureArmPagedFetchGateway {
  fetchPaged<T>(options: {
    url: string;
    accessToken: string;
    maxItems: number;
    logEvent: AzureArmPagedFetchLogEvent;
    abortSignal?: AbortSignal;
  }): Promise<T[]>;
}
