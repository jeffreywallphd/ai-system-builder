import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type {
  ILocalPasswordCredentialService,
  LocalPasswordCredentialMaterial,
} from "../../../application/identity/ports/ILocalPasswordCredentialService";

const scrypt = promisify(scryptCallback);
const PHC_ID = "scrypt";
const DERIVED_KEY_LENGTH = 64;
const SALT_BYTES = 16;

export interface ScryptLocalPasswordCredentialServiceOptions {
  readonly costFactor?: number;
  readonly blockSize?: number;
  readonly parallelization?: number;
  readonly maxMemoryBytes?: number;
  readonly pepperVersion?: string;
}

export class ScryptLocalPasswordCredentialService implements ILocalPasswordCredentialService {
  private readonly costFactor: number;
  private readonly blockSize: number;
  private readonly parallelization: number;
  private readonly maxMemoryBytes: number;
  private readonly pepperVersion?: string;

  public constructor(options: ScryptLocalPasswordCredentialServiceOptions = {}) {
    this.costFactor = options.costFactor ?? 16384;
    this.blockSize = options.blockSize ?? 8;
    this.parallelization = options.parallelization ?? 1;
    assertPositiveInteger(this.costFactor, "costFactor");
    assertPowerOfTwo(this.costFactor, "costFactor");
    assertPositiveInteger(this.blockSize, "blockSize");
    assertPositiveInteger(this.parallelization, "parallelization");
    this.maxMemoryBytes = options.maxMemoryBytes ?? 128 * this.costFactor * this.blockSize * this.parallelization;
    assertPositiveInteger(this.maxMemoryBytes, "maxMemoryBytes");
    this.pepperVersion = normalizeOptional(options.pepperVersion);
  }

  public normalizePassword(candidate: string): string {
    return candidate.normalize("NFKC");
  }

  public async hashPassword(candidate: string): Promise<LocalPasswordCredentialMaterial> {
    const normalizedCandidate = this.normalizePassword(candidate);
    const salt = randomBytes(SALT_BYTES);
    const derived = await this.deriveKey(normalizedCandidate, salt);

    return Object.freeze({
      hashAlgorithm: PHC_ID,
      hashValue: this.encodePhc({
        costFactor: this.costFactor,
        blockSize: this.blockSize,
        parallelization: this.parallelization,
        salt,
        derived,
      }),
      salt: encodeBase64Url(salt),
      pepperVersion: this.pepperVersion,
    });
  }

  public async verifyPassword(candidate: string, material: LocalPasswordCredentialMaterial): Promise<boolean> {
    if (material.hashAlgorithm !== PHC_ID) {
      return false;
    }

    const parsed = this.parsePhc(material.hashValue);
    if (!parsed) {
      return false;
    }

    const normalizedCandidate = this.normalizePassword(candidate);
    const derived = await this.deriveKey(
      normalizedCandidate,
      parsed.salt,
      parsed.costFactor,
      parsed.blockSize,
      parsed.parallelization,
      parsed.derived.length,
    );

    if (derived.length !== parsed.derived.length) {
      return false;
    }

    return timingSafeEqual(derived, parsed.derived);
  }

  private async deriveKey(
    candidate: string,
    salt: Uint8Array,
    costFactor: number = this.costFactor,
    blockSize: number = this.blockSize,
    parallelization: number = this.parallelization,
    keyLength: number = DERIVED_KEY_LENGTH,
  ): Promise<Buffer> {
    const dynamicMaxMemory = Math.max(
      this.maxMemoryBytes,
      128 * costFactor * blockSize * parallelization,
    );
    const derived = await scrypt(candidate, salt, keyLength, {
      N: costFactor,
      r: blockSize,
      p: parallelization,
      maxmem: dynamicMaxMemory,
    });
    return Buffer.from(derived);
  }

  private encodePhc(input: {
    readonly costFactor: number;
    readonly blockSize: number;
    readonly parallelization: number;
    readonly salt: Uint8Array;
    readonly derived: Uint8Array;
  }): string {
    return `$${PHC_ID}$ln=${Math.log2(input.costFactor)},r=${input.blockSize},p=${input.parallelization}$${encodeBase64Url(input.salt)}$${encodeBase64Url(input.derived)}`;
  }

  private parsePhc(value: string): {
    readonly costFactor: number;
    readonly blockSize: number;
    readonly parallelization: number;
    readonly salt: Buffer;
    readonly derived: Buffer;
  } | undefined {
    const match = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(value.trim());
    if (!match) {
      return undefined;
    }

    const logN = Number.parseInt(match[1] ?? "", 10);
    const blockSize = Number.parseInt(match[2] ?? "", 10);
    const parallelization = Number.parseInt(match[3] ?? "", 10);
    if (
      !Number.isInteger(logN)
      || !Number.isInteger(blockSize)
      || !Number.isInteger(parallelization)
      || logN < 1
      || blockSize < 1
      || parallelization < 1
    ) {
      return undefined;
    }

    try {
      return Object.freeze({
        costFactor: 2 ** logN,
        blockSize,
        parallelization,
        salt: decodeBase64Url(match[4] ?? ""),
        derived: decodeBase64Url(match[5] ?? ""),
      });
    } catch {
      return undefined;
    }
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function encodeBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`ScryptLocalPasswordCredentialService requires a positive integer '${field}'.`);
  }
}

function assertPowerOfTwo(value: number, field: string): void {
  if ((value & (value - 1)) !== 0) {
    throw new Error(`ScryptLocalPasswordCredentialService requires '${field}' to be a power of two.`);
  }
}
