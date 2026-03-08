/**
 * Test module verifying settings section rendering with shared view types.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SSRProvider } from "@fluentui/react-components";
import { AzureConnectionSection } from "./AzureConnectionSection";
import { UtilityModelSection } from "./UtilityModelSection";

describe("settings sections", () => {
  it("renders Azure connection summary from shared view types", () => {
    const markup = renderToStaticMarkup(
      <SSRProvider>
        <AzureConnectionSection
          isAzureAuthRequired={false}
          isSending={false}
          isStartingAzureLogin={false}
          onAzureLogin={() => undefined}
          azureTenants={[
            {
              tenantId: "tenant-1",
              displayName: "Tenant One",
              defaultDomain: "tenant.example.com",
            },
          ]}
          activeAzureTenantId="tenant-1"
          isSwitchingAzureTenant={false}
          onAzureTenantChange={() => undefined}
          isLoadingAzureConnections={false}
          isLoadingAzureDeployments={false}
          isReloadingAzureCatalog={false}
          onAzureCatalogReload={() => undefined}
          activeAzureConnection={{
            projectName: "Playground Project",
            baseUrl: "https://example.openai.azure.com/openai/v1/",
            apiVersion: "2026-01-01",
          }}
          activeAzurePrincipal={{
            tenantId: "tenant-1",
            principalId: "principal-1",
            displayName: "Example User",
            principalName: "example.user@tenant.example.com",
            principalType: "user",
          }}
          selectedPlaygroundAzureDeploymentName="gpt-4o"
          isStartingAzureLogout={false}
          onAzureLogout={() => undefined}
          azureTenantSwitchError={null}
          azureLogoutError={null}
          azureConnectionError={null}
        />
      </SSRProvider>,
    );

    expect(markup).toContain("Example User");
    expect(markup).toContain("Playground Project");
    expect(markup).toContain("https://example.openai.azure.com/openai/v1/");
    expect(markup).toContain("gpt-4o");
  });

  it("renders Utility model selectors with shared Azure connection options", () => {
    const markup = renderToStaticMarkup(
      <SSRProvider>
        <UtilityModelSection
          isAzureAuthRequired={false}
          isSending={false}
          isLoadingAzureConnections={false}
          isLoadingUtilityAzureDeployments={false}
          azureConnections={[
            {
              id: "project-1",
              projectName: "Utility Project",
            },
          ]}
          selectedUtilityAzureConnectionId="project-1"
          selectedUtilityAzureDeploymentName="gpt-4.1-mini"
          utilityAzureDeployments={["gpt-4.1-mini", "gpt-4o-mini"]}
          utilityReasoningEffort="medium"
          utilityReasoningEffortOptions={["none", "minimal", "low", "medium", "high", "xhigh"]}
          isUtilityReasoningEffortSupported={true}
          utilityAzureDeploymentError={null}
          onUtilityProjectChange={() => undefined}
          onUtilityDeploymentChange={() => undefined}
          onUtilityReasoningEffortChange={() => undefined}
        />
      </SSRProvider>,
    );

    expect(markup).toContain("Utility Project");
    expect(markup).toContain("gpt-4.1-mini");
    expect(markup).toContain("Utility Reasoning Effort");
  });
});
