import {
  readFileOpenStrategy,
  type FileOpenStrategy,
} from "~/lib/client/infrastructure/browser/workspace-runtime-capabilities";

type FileInputWithPicker = HTMLInputElement & {
  showPicker?: () => void;
};

export type OpenClientFileInputPickerResult = {
  ok: boolean;
  strategy: FileOpenStrategy;
};

export function openClientFileInputPicker(
  input: HTMLInputElement | null,
): OpenClientFileInputPickerResult {
  if (!input || input.disabled) {
    return {
      ok: false,
      strategy: "unavailable",
    };
  }

  const preferredStrategy = readFileOpenStrategy(input);
  const pickerInput = input as FileInputWithPicker;
  if (preferredStrategy === "show-picker") {
    try {
      pickerInput.showPicker();
      return {
        ok: true,
        strategy: "show-picker",
      };
    } catch {
      // Some embedded browsers expose showPicker() but still reject it.
    }
  }

  input.click();
  return {
    ok: true,
    strategy: "input-click",
  };
}
