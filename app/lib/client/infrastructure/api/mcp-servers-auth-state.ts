export type McpServersAuthState = {
  authRequired?: boolean;
};

export function isMcpServersAuthRequired(
  status: number,
  payload: McpServersAuthState | null | undefined,
): boolean {
  return status === 401 || payload?.authRequired === true;
}
