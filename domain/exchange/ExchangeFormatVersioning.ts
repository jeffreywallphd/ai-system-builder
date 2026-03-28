export const ExchangeFormatCompatibilities = Object.freeze({
  compatible: "compatible",
  incompatible: "incompatible",
  unknown: "unknown",
});

export type ExchangeFormatCompatibility =
  typeof ExchangeFormatCompatibilities[keyof typeof ExchangeFormatCompatibilities];

export class ExchangeFormatVersion {
  public readonly value: string;
  public readonly family: string;
  public readonly revision?: number;

  private constructor(input: { readonly value: string; readonly family: string; readonly revision?: number }) {
    this.value = input.value;
    this.family = input.family;
    this.revision = input.revision;
  }

  public static readonly current = "ai-loom.exchange-bundle.v1" as const;

  public static from(value?: string): ExchangeFormatVersion {
    const normalized = (value ?? ExchangeFormatVersion.current).trim();
    if (!normalized) {
      throw new Error("ExchangeFormatVersion cannot be empty.");
    }

    const versionPattern = /^(ai-loom\.exchange-bundle)\.v([0-9]+)$/;
    const match = versionPattern.exec(normalized);
    if (!match) {
      return new ExchangeFormatVersion({ value: normalized, family: "unknown" });
    }

    const revision = Number(match[2]);
    if (!Number.isInteger(revision) || revision < 1) {
      return new ExchangeFormatVersion({ value: normalized, family: "unknown" });
    }

    return new ExchangeFormatVersion({
      value: normalized,
      family: match[1],
      revision,
    });
  }

  public isKnownFamily(): boolean {
    return this.family !== "unknown" && typeof this.revision === "number";
  }
}

export interface ExchangeFormatVersionSupport {
  readonly version: ExchangeFormatVersion;
  readonly compatibility: ExchangeFormatCompatibility;
  readonly supportedRange: {
    readonly minimum: ExchangeFormatVersion;
    readonly maximum: ExchangeFormatVersion;
  };
  readonly reason?: string;
}

export class ExchangeFormatVersionPolicy {
  public readonly minimumSupported: ExchangeFormatVersion;
  public readonly maximumSupported: ExchangeFormatVersion;
  public readonly knownFamily: string;

  private constructor(input: {
    readonly minimumSupported: ExchangeFormatVersion;
    readonly maximumSupported: ExchangeFormatVersion;
    readonly knownFamily: string;
  }) {
    this.minimumSupported = input.minimumSupported;
    this.maximumSupported = input.maximumSupported;
    this.knownFamily = input.knownFamily;
  }

  public static readonly default = ExchangeFormatVersionPolicy.create({
    minimumSupported: ExchangeFormatVersion.current,
    maximumSupported: ExchangeFormatVersion.current,
  });

  public static create(input: {
    readonly minimumSupported: string;
    readonly maximumSupported: string;
    readonly knownFamily?: string;
  }): ExchangeFormatVersionPolicy {
    const minimum = ExchangeFormatVersion.from(input.minimumSupported);
    const maximum = ExchangeFormatVersion.from(input.maximumSupported);
    if (!minimum.isKnownFamily() || !maximum.isKnownFamily()) {
      throw new Error("ExchangeFormatVersionPolicy bounds must be known exchange format versions.");
    }
    if (minimum.family !== maximum.family) {
      throw new Error("ExchangeFormatVersionPolicy bounds must use the same version family.");
    }
    if ((minimum.revision ?? 0) > (maximum.revision ?? 0)) {
      throw new Error("ExchangeFormatVersionPolicy minimum cannot exceed maximum.");
    }
    return new ExchangeFormatVersionPolicy({
      minimumSupported: minimum,
      maximumSupported: maximum,
      knownFamily: input.knownFamily?.trim() || minimum.family,
    });
  }

  public evaluate(versionLike: string | ExchangeFormatVersion): ExchangeFormatVersionSupport {
    const version = typeof versionLike === "string" ? ExchangeFormatVersion.from(versionLike) : versionLike;
    const supportedRange = {
      minimum: this.minimumSupported,
      maximum: this.maximumSupported,
    } as const;

    if (!version.isKnownFamily()) {
      return Object.freeze({
        version,
        compatibility: ExchangeFormatCompatibilities.unknown,
        supportedRange,
        reason: `Exchange format '${version.value}' does not match a known exchange format family.`,
      });
    }

    if (version.family !== this.knownFamily) {
      return Object.freeze({
        version,
        compatibility: ExchangeFormatCompatibilities.incompatible,
        supportedRange,
        reason: `Exchange format family '${version.family}' is not supported by this policy.`,
      });
    }

    const revision = version.revision ?? -1;
    const minimumRevision = this.minimumSupported.revision ?? 0;
    const maximumRevision = this.maximumSupported.revision ?? 0;
    if (revision < minimumRevision || revision > maximumRevision) {
      return Object.freeze({
        version,
        compatibility: ExchangeFormatCompatibilities.incompatible,
        supportedRange,
        reason: `Exchange format revision v${revision} is outside the supported range v${minimumRevision}-v${maximumRevision}.`,
      });
    }

    return Object.freeze({
      version,
      compatibility: ExchangeFormatCompatibilities.compatible,
      supportedRange,
    });
  }
}

export class UnsupportedExchangeFormatFailure extends Error {
  public readonly versionSupport: ExchangeFormatVersionSupport;

  public constructor(versionSupport: ExchangeFormatVersionSupport) {
    super(versionSupport.reason ?? `Unsupported exchange format version '${versionSupport.version.value}'.`);
    this.name = "UnsupportedExchangeFormatFailure";
    this.versionSupport = versionSupport;
  }
}

