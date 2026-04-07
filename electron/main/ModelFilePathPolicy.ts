import path from "node:path";

const WINDOWS_DRIVE_PREFIX_PATTERN = /^[a-zA-Z]:/;

function normalizeRootDirectory(rootDirectory: string): string {
  const normalized = path.resolve(rootDirectory.trim());
  if (!normalized) {
    throw new Error("Model file root directory is required.");
  }
  return normalized;
}

function normalizeLogicalModelPath(modelPath: string): string {
  const trimmed = modelPath.trim();
  if (!trimmed) {
    return "";
  }

  const slashNormalized = trimmed.replace(/\\/g, "/");
  if (slashNormalized.startsWith("/") || WINDOWS_DRIVE_PREFIX_PATTERN.test(slashNormalized)) {
    throw new Error("Model file paths must be logical paths relative to the managed model root.");
  }

  const segments = slashNormalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "";
  }

  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new Error("Model file paths cannot include traversal or dot segments.");
    }
  }

  return segments.join("/");
}

function assertInsideRoot(rootDirectory: string, absolutePath: string): void {
  const relative = path.relative(rootDirectory, absolutePath);
  if (relative === "") {
    return;
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved model file path escapes the managed model root.");
  }
}

export function resolveModelFileAbsolutePath(rootDirectory: string, modelPath: string): string {
  const normalizedRoot = normalizeRootDirectory(rootDirectory);
  const normalizedModelPath = normalizeLogicalModelPath(modelPath);
  const absolutePath = normalizedModelPath
    ? path.resolve(normalizedRoot, ...normalizedModelPath.split("/"))
    : normalizedRoot;
  assertInsideRoot(normalizedRoot, absolutePath);
  return absolutePath;
}

export function toLogicalModelPath(rootDirectory: string, absolutePath: string): string {
  const normalizedRoot = normalizeRootDirectory(rootDirectory);
  const normalizedAbsolute = path.resolve(absolutePath.trim());
  assertInsideRoot(normalizedRoot, normalizedAbsolute);
  const relative = path.relative(normalizedRoot, normalizedAbsolute);
  if (!relative) {
    return "";
  }
  return relative.split(path.sep).join("/");
}

