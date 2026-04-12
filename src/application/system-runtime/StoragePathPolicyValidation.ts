export interface StoragePathValidationIssue {
  readonly code: "storage-path-configuration-forbidden";
  readonly path: string;
  readonly key: string;
  readonly message: string;
}

const forbiddenStoragePathKeyTokens = Object.freeze([
  "path",
  "directory",
  "filesystem",
  "storageroot",
]);

function toRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

function hasForbiddenToken(key: string): boolean {
  const normalized = key.toLowerCase();
  return forbiddenStoragePathKeyTokens.some((token) => normalized.includes(token));
}

function collectIssues(
  input: unknown,
  basePath: string,
  into: StoragePathValidationIssue[],
): void {
  const node = toRecord(input);
  if (!node) {
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    const nextPath = basePath ? `${basePath}.${key}` : key;
    if (hasForbiddenToken(key)) {
      into.push(Object.freeze({
        code: "storage-path-configuration-forbidden",
        path: nextPath,
        key,
        message: `Field '${nextPath}' is not allowed. Storage paths are infrastructure-owned and must not be caller configured.`,
      }));
    }
    collectIssues(value, nextPath, into);
  }
}

export function validateNoUserManagedStoragePaths(
  input: unknown,
  rootPath = "request",
): ReadonlyArray<StoragePathValidationIssue> {
  const issues: StoragePathValidationIssue[] = [];
  collectIssues(input, rootPath, issues);
  return Object.freeze(issues);
}

export function assertNoUserManagedStoragePaths(
  input: unknown,
  message: string,
): void {
  const issues = validateNoUserManagedStoragePaths(input);
  if (issues.length === 0) {
    return;
  }
  throw new Error(`${message} (${issues.map((issue) => issue.path).join(", ")})`);
}
