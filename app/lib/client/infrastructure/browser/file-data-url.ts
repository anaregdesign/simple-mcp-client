export async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string" && reader.result.trim()) {
        resolve(reader.result);
        return;
      }

      reject(new Error("File data is empty."));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Failed to read file."));
    });
    reader.readAsDataURL(file);
  });
}
