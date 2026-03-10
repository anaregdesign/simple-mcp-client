export type ThreadInstruction = {
  id: number;
  threadId: string;
  content: string;
};

export function cloneThreadInstruction(
  instruction: ThreadInstruction | null,
): ThreadInstruction | null {
  return instruction ? { ...instruction } : null;
}
