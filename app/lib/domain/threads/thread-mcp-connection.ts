import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import { WorkspaceMcpServerProfile } from "~/lib/domain/mcp/workspace-mcp-server-profile";
import { DomainError } from "~/lib/domain/shared/domain-error";

export class ThreadMcpConnection {
  readonly profile: WorkspaceMcpServerProfile;
  readonly id: string;
  readonly name: string;
  readonly connectOnThreadCreate: boolean;
  readonly transport: McpServerConfig["transport"];
  readonly url: string | undefined;
  readonly headers: Record<string, string>;
  readonly useAzureAuth: boolean;
  readonly azureAuthScope: string;
  readonly timeoutSeconds: number;
  readonly command: string | undefined;
  readonly args: string[];
  readonly cwd: string | undefined;
  readonly env: Record<string, string>;

  constructor(snapshot: McpServerConfig) {
    if (!snapshot.id.trim()) {
      throw new DomainError(
        "thread_mcp_connection_id_required",
        "ThreadMcpConnection id is required.",
      );
    }

    this.profile = new WorkspaceMcpServerProfile({
      ...snapshot,
      connectOnThreadCreate: snapshot.connectOnThreadCreate === true,
    });
    this.id = snapshot.id.trim();
    this.name = snapshot.name.trim();
    this.connectOnThreadCreate = snapshot.connectOnThreadCreate === true;
    this.transport = snapshot.transport;
    this.url = snapshot.transport === "stdio" ? undefined : snapshot.url;
    this.headers = snapshot.transport === "stdio" ? {} : { ...snapshot.headers };
    this.useAzureAuth = snapshot.transport === "stdio" ? false : snapshot.useAzureAuth;
    this.azureAuthScope = snapshot.transport === "stdio" ? "" : snapshot.azureAuthScope;
    this.timeoutSeconds = snapshot.transport === "stdio" ? 0 : snapshot.timeoutSeconds;
    this.command = snapshot.transport === "stdio" ? snapshot.command : undefined;
    this.args = snapshot.transport === "stdio" ? [...snapshot.args] : [];
    this.cwd = snapshot.transport === "stdio" ? snapshot.cwd : undefined;
    this.env = snapshot.transport === "stdio" ? { ...snapshot.env } : {};
  }

  static fromSnapshot(snapshot: McpServerConfig): ThreadMcpConnection {
    return new ThreadMcpConnection(snapshot);
  }

  isStdio(): boolean {
    return this.profile.isStdio();
  }

  toSnapshot(): McpServerConfig {
    return this.profile.toClientConfig();
  }

  toJSON(): McpServerConfig {
    return this.toSnapshot();
  }
}
