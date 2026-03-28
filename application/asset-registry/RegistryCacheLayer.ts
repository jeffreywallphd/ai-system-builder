export interface RegistryCacheLayerOptions {
  readonly maxEntriesPerNamespace?: number;
}

export interface RegistryCacheLayerStats {
  readonly hits: number;
  readonly misses: number;
  readonly sets: number;
  readonly evictions: number;
  readonly invalidations: number;
}

interface CacheEntry<T> {
  readonly key: string;
  readonly value: T;
  readonly storedAt: Date;
}

interface NamespaceStore {
  readonly entries: Map<string, CacheEntry<unknown>>;
  signature?: string;
}

const DEFAULT_MAX_ENTRIES = 200;

export class RegistryCacheLayer {
  private readonly namespaces = new Map<string, NamespaceStore>();
  private readonly maxEntriesPerNamespace: number;
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private evictions = 0;
  private invalidations = 0;

  constructor(options: RegistryCacheLayerOptions = {}) {
    this.maxEntriesPerNamespace = options.maxEntriesPerNamespace && options.maxEntriesPerNamespace > 0
      ? options.maxEntriesPerNamespace
      : DEFAULT_MAX_ENTRIES;
  }

  public getStats(): RegistryCacheLayerStats {
    return Object.freeze({
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      evictions: this.evictions,
      invalidations: this.invalidations,
    });
  }

  public invalidateNamespace(namespace: string): void {
    const normalized = namespace.trim();
    if (!normalized) {
      return;
    }

    if (this.namespaces.delete(normalized)) {
      this.invalidations += 1;
    }
  }

  public invalidateAll(): void {
    if (this.namespaces.size > 0) {
      this.invalidations += this.namespaces.size;
      this.namespaces.clear();
    }
  }

  public enforceNamespaceSignature(namespace: string, signature?: string): void {
    const normalized = namespace.trim();
    if (!normalized || !signature) {
      return;
    }

    const store = this.namespaces.get(normalized);
    if (!store) {
      this.namespaces.set(normalized, {
        entries: new Map<string, CacheEntry<unknown>>(),
        signature,
      });
      return;
    }

    if (store.signature && store.signature !== signature) {
      this.namespaces.set(normalized, {
        entries: new Map<string, CacheEntry<unknown>>(),
        signature,
      });
      this.invalidations += 1;
      return;
    }

    store.signature = signature;
  }

  public getOrSet<T>(namespace: string, key: string, factory: () => Promise<T>): Promise<T> {
    const normalizedNamespace = namespace.trim();
    const normalizedKey = key.trim();
    if (!normalizedNamespace || !normalizedKey) {
      return factory();
    }

    const store = this.ensureNamespace(normalizedNamespace);
    const existing = store.entries.get(normalizedKey) as CacheEntry<T> | undefined;
    if (existing) {
      this.hits += 1;
      store.entries.delete(normalizedKey);
      store.entries.set(normalizedKey, existing);
      return Promise.resolve(existing.value);
    }

    this.misses += 1;
    return factory().then((computed) => {
      this.sets += 1;
      store.entries.set(normalizedKey, Object.freeze({
        key: normalizedKey,
        value: computed,
        storedAt: new Date(),
      }));
      this.evictOverflow(store);
      return computed;
    });
  }

  private ensureNamespace(namespace: string): NamespaceStore {
    const existing = this.namespaces.get(namespace);
    if (existing) {
      return existing;
    }

    const created: NamespaceStore = { entries: new Map<string, CacheEntry<unknown>>() };
    this.namespaces.set(namespace, created);
    return created;
  }

  private evictOverflow(store: NamespaceStore): void {
    while (store.entries.size > this.maxEntriesPerNamespace) {
      const oldest = store.entries.keys().next().value;
      if (!oldest) {
        break;
      }
      store.entries.delete(oldest);
      this.evictions += 1;
    }
  }
}
