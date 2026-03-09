export interface AzureSessionGateway {
  authenticate(scope: string, tenantId?: string): Promise<void>;
  reset(): void;
}
