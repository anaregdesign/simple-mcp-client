export type WorkspaceMcpServerProfile = {
  id: string;
  userId: number;
  profileOrder: number;
  connectOnThreadCreate: boolean;
  configKey: string;
  name: string;
  transport: string;
  url: string | null;
  headersJson: string | null;
  useAzureAuth: boolean;
  azureAuthScope: string | null;
  timeoutSeconds: number | null;
  command: string | null;
  argsJson: string | null;
  cwd: string | null;
  envJson: string | null;
};

export interface WorkspaceMcpServerProfileRepository {
  listByUserId(userId: number): Promise<WorkspaceMcpServerProfile[]>;
  replaceByUserId(
    userId: number,
    profiles: WorkspaceMcpServerProfile[],
  ): Promise<void>;
}
