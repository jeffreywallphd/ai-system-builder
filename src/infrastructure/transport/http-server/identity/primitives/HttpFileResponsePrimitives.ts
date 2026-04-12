export function buildContentDispositionHeader(
  disposition: "attachment" | "inline",
  fileName: string | undefined,
): string {
  const safeFileName = sanitizeDownloadFileName(fileName);
  if (!safeFileName) {
    return disposition;
  }

  const encoded = encodeURIComponent(safeFileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16)}`,
  );
  return `${disposition}; filename="${safeFileName}"; filename*=UTF-8''${encoded}`;
}

export function sanitizeDownloadFileName(fileName: string | undefined): string | undefined {
  if (!fileName) {
    return undefined;
  }

  const normalized = fileName
    .trim()
    .replace(/["]/g, "'")
    .replace(/[\/\\]/g, "-")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ");
  if (!normalized || normalized === "." || normalized === "..") {
    return undefined;
  }
  return normalized.length > 255 ? normalized.slice(0, 255) : normalized;
}
