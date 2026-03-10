type FileInputWithPicker = HTMLInputElement & {
  showPicker?: () => void;
};

export function openInstructionClientFilePicker(
  input: HTMLInputElement | null,
): boolean {
  if (!input || input.disabled) {
    return false;
  }

  const pickerInput = input as FileInputWithPicker;
  if (typeof pickerInput.showPicker === "function") {
    try {
      pickerInput.showPicker();
      return true;
    } catch {
      // Some embedded browsers expose showPicker() but still reject it.
    }
  }

  input.click();
  return true;
}
