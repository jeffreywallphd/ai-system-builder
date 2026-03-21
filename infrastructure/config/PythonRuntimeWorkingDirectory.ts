const DEFAULT_PYTHON_RUNTIME_DIRECTORY = "python-runtime";
const LEGACY_RELATIVE_PATTERNS = [
  /^dev[\\/]python-runtime$/,
  /^\.[\\/]dev[\\/]python-runtime$/,
];
const LEGACY_SUFFIX_PATTERN = /[\\/]dev[\\/]python-runtime$/;

export function resolveDefaultPythonRuntimeWorkingDirectory(): string {
  if (typeof window !== "undefined") {
    return DEFAULT_PYTHON_RUNTIME_DIRECTORY;
  }

  const processLike = typeof globalThis !== "undefined"
    ? (globalThis as typeof globalThis & { process?: { cwd?: () => string } }).process
    : undefined;
  const cwd = typeof processLike?.cwd === "function"
    ? processLike.cwd()
    : ".";

  return `${cwd}/${DEFAULT_PYTHON_RUNTIME_DIRECTORY}`;
}

export function normalizePythonRuntimeWorkingDirectory(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return resolveDefaultPythonRuntimeWorkingDirectory();
  }

  if (LEGACY_RELATIVE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return DEFAULT_PYTHON_RUNTIME_DIRECTORY;
  }

  if (!LEGACY_SUFFIX_PATTERN.test(trimmed)) {
    return trimmed;
  }

  return trimmed.replace(LEGACY_SUFFIX_PATTERN, "/python-runtime");
}
