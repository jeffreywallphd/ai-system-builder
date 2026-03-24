function normalize(value: string): string {
  return value.trim();
}

export class AssetId {
  public readonly value: string;

  constructor(value: string) {
    const normalized = normalize(value);
    if (!normalized) {
      throw new Error("AssetId cannot be empty.");
    }

    this.value = normalized;
  }

  public equals(other: AssetId | string): boolean {
    const compared = typeof other === "string" ? other.trim() : other.value;
    return this.value === compared;
  }

  public toString(): string {
    return this.value;
  }

  public static from(value: string | AssetId): AssetId {
    return value instanceof AssetId ? value : new AssetId(value);
  }
}
