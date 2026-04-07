export interface LocalPasswordCredentialMaterial {
  readonly hashAlgorithm: string;
  readonly hashValue: string;
  readonly salt?: string;
  readonly pepperVersion?: string;
}

export interface ILocalPasswordCredentialService {
  normalizePassword(candidate: string): string;
  hashPassword(candidate: string): Promise<LocalPasswordCredentialMaterial>;
  verifyPassword(candidate: string, material: LocalPasswordCredentialMaterial): Promise<boolean>;
}
