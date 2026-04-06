export interface PersistenceClock {
  now(): string;
}

export const SystemPersistenceClock: PersistenceClock = Object.freeze({
  now: () => new Date().toISOString(),
});

export function isIsoUtcTimestamp(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  const parsed = new Date(normalized);
  return !Number.isNaN(parsed.getTime());
}

export function resolvePersistenceTimestamp(candidate: string | undefined, clock: PersistenceClock = SystemPersistenceClock): string {
  const normalized = candidate?.trim();
  if (!normalized) {
    return clock.now();
  }

  if (!isIsoUtcTimestamp(normalized)) {
    throw new Error(`Persistence timestamp '${normalized}' must be a canonical ISO-8601 UTC string.`);
  }

  return new Date(normalized).toISOString();
}
