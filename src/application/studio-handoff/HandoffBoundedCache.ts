export interface HandoffBoundedCacheOptions {
  readonly maxEntries?: number;
}

export class HandoffBoundedCache<TKey, TValue> {
  private readonly maxEntries: number;
  private readonly entries = new Map<TKey, TValue>();

  public constructor(options: HandoffBoundedCacheOptions = {}) {
    const configured = options.maxEntries ?? 128;
    this.maxEntries = Number.isFinite(configured) ? Math.max(1, Math.floor(configured)) : 128;
  }

  public get(key: TKey): TValue | undefined {
    const existing = this.entries.get(key);
    if (existing === undefined) {
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, existing);
    return existing;
  }

  public set(key: TKey, value: TValue): TValue {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }
    this.entries.set(key, value);
    this.evictIfNeeded();
    return value;
  }

  public clear(): void {
    this.entries.clear();
  }

  private evictIfNeeded(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      this.entries.delete(oldest);
    }
  }
}
