/**
 * Client UI component module.
 */
import { FluentUI } from "~/components/shared/fluent";
import { ConfigSection } from "~/components/shared/ConfigSection";
import { CopyableStatusMessageList } from "~/components/CopyableStatusMessageList";
import { SubSection } from "~/components/shared/SubSection";
import type {
  AzureConnectionView,
  AzurePrincipalView,
  AzureTenantView,
} from "~/lib/client/usecase/workspace/view-types";

const { Button, Select, Spinner } = FluentUI;

type AzureConnectionSectionProps = {
  isAzureAuthRequired: boolean;
  isSending: boolean;
  isStartingAzureLogin: boolean;
  onAzureLogin: () => void | Promise<void>;
  azureTenants: AzureTenantView[];
  activeAzureTenantId: string;
  isSwitchingAzureTenant: boolean;
  onAzureTenantChange: (tenantId: string) => void;
  isLoadingAzureConnections: boolean;
  isLoadingAzureDeployments: boolean;
  isReloadingAzureCatalog: boolean;
  onAzureCatalogReload: () => void | Promise<void>;
  activeAzureConnection: AzureConnectionView | null;
  activeAzurePrincipal: AzurePrincipalView | null;
  selectedPlaygroundAzureDeploymentName: string;
  isStartingAzureLogout: boolean;
  onAzureLogout: () => void | Promise<void>;
  azureTenantSwitchError: string | null;
  azureLogoutError: string | null;
  azureConnectionError: string | null;
};

export function AzureConnectionSection(props: AzureConnectionSectionProps) {
  const {
    isAzureAuthRequired,
    isSending,
    isStartingAzureLogin,
    onAzureLogin,
    azureTenants,
    activeAzureTenantId,
    isSwitchingAzureTenant,
    onAzureTenantChange,
    isLoadingAzureConnections,
    isLoadingAzureDeployments,
    isReloadingAzureCatalog,
    onAzureCatalogReload,
    activeAzureConnection,
    activeAzurePrincipal,
    selectedPlaygroundAzureDeploymentName,
    isStartingAzureLogout,
    onAzureLogout,
    azureTenantSwitchError,
    azureLogoutError,
    azureConnectionError,
  } = props;
  const hasActiveAzureContext = Boolean(activeAzureConnection || activeAzurePrincipal);
  const showAzureTenantSubSection = Boolean(activeAzurePrincipal && azureTenants.length > 0);
  const isAzureLogoutDisabled =
    isSending || isLoadingAzureConnections || isSwitchingAzureTenant || isStartingAzureLogout;
  const azureConnectionSummary = hasActiveAzureContext ? (
    <dl className="azure-connection-summary" aria-label="Active Azure connection details">
      {activeAzurePrincipal ? (
        <>
          <div className="azure-connection-summary-row">
            <dt>Principal</dt>
            <dd>{activeAzurePrincipal.displayName || activeAzurePrincipal.principalId}</dd>
          </div>
          {activeAzurePrincipal.principalName ? (
            <div className="azure-connection-summary-row">
              <dt>Principal name</dt>
              <dd>{activeAzurePrincipal.principalName}</dd>
            </div>
          ) : null}
          <div className="azure-connection-summary-row">
            <dt>Principal type</dt>
            <dd>{formatPrincipalTypeLabel(activeAzurePrincipal.principalType)}</dd>
          </div>
          <div className="azure-connection-summary-row">
            <dt>Tenant ID</dt>
            <dd>{activeAzurePrincipal.tenantId}</dd>
          </div>
          <div className="azure-connection-summary-row">
            <dt>Principal ID</dt>
            <dd>{activeAzurePrincipal.principalId}</dd>
          </div>
        </>
      ) : null}
      <div className="azure-connection-summary-row">
        <dt>Playground project</dt>
        <dd>{activeAzureConnection?.projectName ?? "Not selected"}</dd>
      </div>
      <div className="azure-connection-summary-row">
        <dt>Playground deployment</dt>
        <dd>{selectedPlaygroundAzureDeploymentName || "Not selected"}</dd>
      </div>
      <div className="azure-connection-summary-row">
        <dt>Endpoint</dt>
        <dd>{activeAzureConnection?.baseUrl ?? "Not selected"}</dd>
      </div>
      <div className="azure-connection-summary-row">
        <dt>API version</dt>
        <dd>{activeAzureConnection?.apiVersion ?? "Not selected"}</dd>
      </div>
    </dl>
  ) : (
    <p className="field-hint">No active Azure project.</p>
  );

  return (
    <ConfigSection
      className="setting-group-azure-connection"
      title="Azure Connection 🔐"
      description="Sign in/out, switch Azure tenant, and review the active Playground model."
    >
      {isAzureAuthRequired ? (
        <Button
          type="button"
          appearance="primary"
          className="azure-login-btn"
          title="Start Azure login in your browser."
          onClick={() => {
            void onAzureLogin();
          }}
          disabled={isSending || isStartingAzureLogin}
        >
          {isStartingAzureLogin ? "🔐 Starting Azure Login..." : "🔐 Azure Login"}
        </Button>
      ) : (
        <>
          {hasActiveAzureContext ? (
            <div className="selectable-card-header-row selectable-card-header-row-right">
              <Button
                type="button"
                appearance="subtle"
                size="small"
                className="selectable-card-reload-btn"
                title="Reload tenant, project, and deployment lists from Azure."
                onClick={() => {
                  void onAzureCatalogReload();
                }}
                disabled={
                  isSending ||
                  isLoadingAzureConnections ||
                  isLoadingAzureDeployments ||
                  isSwitchingAzureTenant ||
                  isStartingAzureLogout ||
                  isReloadingAzureCatalog
                }
              >
                ↻ Reload
              </Button>
            </div>
          ) : null}
          {isLoadingAzureConnections || isLoadingAzureDeployments ? (
            <div className="azure-loading-notice" role="status" aria-live="polite">
              <Spinner size="tiny" />
              {isLoadingAzureConnections
                ? "Loading projects from Azure..."
                : "Loading deployments for the selected project..."}
            </div>
          ) : null}
          {showAzureTenantSubSection ? (
            <SubSection
              className="azure-tenant-subsection"
              title="Azure Tenant"
              description="Switch signed-in tenant. Project and deployment catalog reloads automatically."
            >
              <Select
                id="azure-connection-tenant"
                aria-label="Azure Tenant"
                value={activeAzureTenantId}
                onChange={(_, data) => {
                  onAzureTenantChange(data.value);
                }}
                disabled={
                  isSending ||
                  isStartingAzureLogin ||
                  isSwitchingAzureTenant ||
                  isStartingAzureLogout ||
                  isLoadingAzureConnections
                }
                title="Switch tenant after login. Projects and deployments will reload."
              >
                {azureTenants.map((tenant) => (
                  <option key={tenant.tenantId} value={tenant.tenantId}>
                    {formatAzureTenantLabel(tenant)}
                  </option>
                ))}
              </Select>
              {isSwitchingAzureTenant ? (
                <div className="azure-loading-notice" role="status" aria-live="polite">
                  <Spinner size="tiny" />
                  Switching tenant and reloading projects...
                </div>
              ) : null}
              {azureConnectionSummary}
              <div className="azure-connection-actions">
                <Button
                  type="button"
                  appearance="outline"
                  className="azure-logout-btn"
                  title="Sign out from Azure for this app."
                  onClick={() => {
                    void onAzureLogout();
                  }}
                  disabled={isAzureLogoutDisabled}
                >
                  {isStartingAzureLogout ? "🚪 Logging Out..." : "🚪 Logout"}
                </Button>
              </div>
            </SubSection>
          ) : null}
          {!showAzureTenantSubSection ? azureConnectionSummary : null}
          {hasActiveAzureContext && !showAzureTenantSubSection ? (
            <div className="azure-connection-actions">
              <Button
                type="button"
                appearance="outline"
                className="azure-logout-btn"
                title="Sign out from Azure for this app."
                onClick={() => {
                  void onAzureLogout();
                }}
                disabled={isAzureLogoutDisabled}
              >
                {isStartingAzureLogout ? "🚪 Logging Out..." : "🚪 Logout"}
              </Button>
            </div>
          ) : null}
          <CopyableStatusMessageList
            messages={[
              { intent: "error", text: azureTenantSwitchError },
              { intent: "error", text: azureLogoutError },
              { intent: "error", text: azureConnectionError },
            ]}
          />
        </>
      )}
    </ConfigSection>
  );
}

function formatPrincipalTypeLabel(
  principalType: AzurePrincipalView["principalType"],
): string {
  if (principalType === "servicePrincipal") {
    return "Service principal";
  }
  if (principalType === "managedIdentity") {
    return "Managed identity";
  }
  if (principalType === "user") {
    return "User";
  }
  return "Unknown";
}

function formatAzureTenantLabel(tenant: AzureTenantView): string {
  const displayName = tenant.displayName.trim() || tenant.tenantId;
  const defaultDomain = tenant.defaultDomain.trim();
  if (defaultDomain && displayName !== defaultDomain) {
    return `${displayName} (${defaultDomain}) — ${tenant.tenantId}`;
  }

  if (displayName !== tenant.tenantId) {
    return `${displayName} — ${tenant.tenantId}`;
  }

  return tenant.tenantId;
}
