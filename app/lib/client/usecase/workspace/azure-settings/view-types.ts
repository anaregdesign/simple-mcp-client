import type { AzurePrincipalType } from "~/lib/domain/value-objects/azure-principal-type";

export type AzureConnectionOptionView = {
  id: string;
  projectName: string;
};

export type AzureConnectionView = {
  id?: string;
  projectName: string;
  baseUrl: string;
  apiVersion: string;
};

export type AzurePrincipalView = {
  tenantId: string;
  principalId: string;
  displayName: string;
  principalName: string;
  principalType: AzurePrincipalType;
};

export type AzureTenantView = {
  tenantId: string;
  displayName: string;
  defaultDomain: string;
};
