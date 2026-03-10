export type ThreadManagementState = {
  renamingThreadId: string;
  renamingThreadName: string;
};

export const initialThreadManagementState: ThreadManagementState = {
  renamingThreadId: "",
  renamingThreadName: "",
};
