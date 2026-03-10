export function formatPlaygroundAttachmentSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "0 B";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const kb = sizeBytes / 1024;
  if (kb < 1024) {
    return `${trimSizeFraction(kb)} KB`;
  }

  const mb = kb / 1024;
  if (mb < 1024) {
    return `${trimSizeFraction(mb)} MB`;
  }

  const gb = mb / 1024;
  return `${trimSizeFraction(gb)} GB`;
}

function trimSizeFraction(value: number): string {
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}
