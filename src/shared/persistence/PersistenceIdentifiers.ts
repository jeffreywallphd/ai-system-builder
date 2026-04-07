export interface PersistenceIdentifierGenerator {
  next(namespace: string, ...parts: ReadonlyArray<string>): string;
}

const IdentifierTokenPattern = /^[a-z0-9][a-z0-9:_-]{0,255}$/;
const IdentifierNamespacePattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function normalizePersistenceIdentifierToken(token: string, label = "identifier"): string {
  const normalized = token.trim().toLowerCase();
  if (!normalized) {
    throw new Error(`Persistence ${label} is required.`);
  }

  if (!IdentifierTokenPattern.test(normalized)) {
    throw new Error(
      `Persistence ${label} '${normalized}' must use lowercase alphanumeric, ':', '_' or '-' characters.`,
    );
  }

  return normalized;
}

function normalizeNamespace(namespace: string): string {
  const normalized = namespace.trim().toLowerCase();
  if (!IdentifierNamespacePattern.test(normalized)) {
    throw new Error(
      `Persistence namespace '${namespace}' must use lowercase alphanumeric, '_' or '-' characters.`,
    );
  }

  return normalized;
}

function resolveRandomId(randomId: (() => string) | undefined): string {
  if (randomId) {
    return normalizePersistenceIdentifierToken(randomId(), "random token");
  }

  if (typeof globalThis.crypto?.randomUUID === "function") {
    return normalizePersistenceIdentifierToken(globalThis.crypto.randomUUID(), "random token");
  }

  throw new Error("Persistence identifier generator requires a random id provider.");
}

export function createPersistenceIdentifierGenerator(options?: {
  readonly randomId?: () => string;
}): PersistenceIdentifierGenerator {
  const randomId = options?.randomId;

  return Object.freeze({
    next(namespace: string, ...parts: ReadonlyArray<string>): string {
      const normalizedNamespace = normalizeNamespace(namespace);
      const normalizedParts = parts
        .map((part, index) => normalizePersistenceIdentifierToken(part, `id part ${index + 1}`));
      const token = resolveRandomId(randomId);
      return [normalizedNamespace, ...normalizedParts, token].join(":");
    },
  });
}

export function toPersistenceScopedIdentifier(scope: string, id: string): string {
  const normalizedScope = normalizeNamespace(scope);
  const normalizedId = normalizePersistenceIdentifierToken(id);
  return `${normalizedScope}:${normalizedId}`;
}
