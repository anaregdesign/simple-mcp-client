import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { McpTransport } from "~/lib/domain/shared/mcp-transport";
import { DomainError } from "~/lib/domain/shared/domain-error";
import { buildMcpServerConfigKey } from "~/lib/domain/mcp/config-key";

export type WorkspaceMcpServerProfileSnapshot =
  | {
      id: string;
      name: string;
      connectOnThreadCreate: boolean;
      transport: "streamable_http" | "sse";
      url: string;
      headers: Record<string, string>;
      useAzureAuth: boolean;
      azureAuthScope: string;
      timeoutSeconds: number;
    }
  | {
      id: string;
      name: string;
      connectOnThreadCreate: boolean;
      transport: "stdio";
      command: string;
      args: string[];
      cwd?: string;
      env: Record<string, string>;
    };

type WorkspaceMcpServerProfileInit = WorkspaceMcpServerProfileSnapshot | McpServerConfig;

export class WorkspaceMcpServerProfile {
  readonly id: string;
  readonly name: string;
  readonly connectOnThreadCreate: boolean;
  readonly transport: McpTransport;
  readonly url: string | null;
  readonly headers: Record<string, string>;
  readonly useAzureAuth: boolean;
  readonly azureAuthScope: string | null;
  readonly timeoutSeconds: number | null;
  readonly command: string | null;
  readonly args: string[];
  readonly cwd: string | undefined;
  readonly env: Record<string, string>;

  constructor(profile: WorkspaceMcpServerProfileInit) {
    const id = profile.id.trim();
    const name = profile.name.trim();
    if (!id) {
      throw new DomainError(
        "workspace_mcp_server_profile_id_required",
        "WorkspaceMcpServerProfile id is required.",
      );
    }
    if (!name) {
      throw new DomainError(
        "workspace_mcp_server_profile_name_required",
        "WorkspaceMcpServerProfile name is required.",
      );
    }

    this.id = id;
    this.name = name;
    this.connectOnThreadCreate = profile.connectOnThreadCreate === true;
    this.transport = profile.transport;

    if (profile.transport === "stdio") {
      const command = profile.command.trim();
      if (!command) {
        throw new DomainError(
          "workspace_mcp_server_profile_command_required",
          "WorkspaceMcpServerProfile command is required for stdio transport.",
        );
      }

      this.url = null;
      this.headers = {};
      this.useAzureAuth = false;
      this.azureAuthScope = null;
      this.timeoutSeconds = null;
      this.command = command;
      this.args = [...profile.args];
      this.cwd = typeof profile.cwd === "string" && profile.cwd.trim() ? profile.cwd.trim() : undefined;
      this.env = { ...profile.env };
      return;
    }

    const url = profile.url.trim();
    if (!url) {
      throw new DomainError(
        "workspace_mcp_server_profile_url_required",
        "WorkspaceMcpServerProfile url is required for HTTP transport.",
      );
    }

    this.url = url;
    this.headers = { ...profile.headers };
    this.useAzureAuth = profile.useAzureAuth === true;
    this.azureAuthScope = profile.azureAuthScope.trim();
    this.timeoutSeconds = profile.timeoutSeconds;
    this.command = null;
    this.args = [];
    this.cwd = undefined;
    this.env = {};
  }

  static fromSnapshot(profile: WorkspaceMcpServerProfileSnapshot): WorkspaceMcpServerProfile {
    return new WorkspaceMcpServerProfile(profile);
  }

  get configKey(): string {
    return buildMcpServerConfigKey(this.toClientConfig());
  }

  isStdio(): boolean {
    return this.transport === "stdio";
  }

  toClientConfig(): McpServerConfig {
    if (this.transport === "stdio") {
      return {
        id: this.id,
        name: this.name,
        connectOnThreadCreate: this.connectOnThreadCreate,
        transport: this.transport,
        command: this.command ?? "",
        args: [...this.args],
        cwd: this.cwd,
        env: { ...this.env },
      };
    }

    return {
      id: this.id,
      name: this.name,
      connectOnThreadCreate: this.connectOnThreadCreate,
      transport: this.transport,
      url: this.url ?? "",
      headers: { ...this.headers },
      useAzureAuth: this.useAzureAuth,
      azureAuthScope: this.azureAuthScope ?? "",
      timeoutSeconds: this.timeoutSeconds ?? 0,
    };
  }

  toSnapshot(): WorkspaceMcpServerProfileSnapshot {
    if (this.transport === "stdio") {
      return {
        id: this.id,
        name: this.name,
        connectOnThreadCreate: this.connectOnThreadCreate,
        transport: this.transport,
        command: this.command ?? "",
        args: [...this.args],
        cwd: this.cwd,
        env: { ...this.env },
      };
    }

    return {
      id: this.id,
      name: this.name,
      connectOnThreadCreate: this.connectOnThreadCreate,
      transport: this.transport,
      url: this.url ?? "",
      headers: { ...this.headers },
      useAzureAuth: this.useAzureAuth,
      azureAuthScope: this.azureAuthScope ?? "",
      timeoutSeconds: this.timeoutSeconds ?? 0,
    };
  }

  toJSON(): WorkspaceMcpServerProfileSnapshot {
    return this.toSnapshot();
  }
}
