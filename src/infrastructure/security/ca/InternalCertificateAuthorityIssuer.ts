import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  generateKeyPairSync,
  randomBytes,
  sign as signOneShot,
} from "node:crypto";
import { isIP } from "node:net";
import {
  CertificateAuthorityStatuses,
  TrustMaterialKinds,
  type CertificateSubjectDescriptor,
  type CertificateUsageKind,
} from "../../../domain/security/CertificateAuthorityDomain";
import type { ICertificateAuthorityRootMaterialStorage } from "../../../application/security/ports/ICertificateAuthorityRootMaterialStorage";
import type { ICertificateAuthorityRootPersistenceRepository } from "../../../application/security/ports/ICertificateAuthorityRootPersistenceRepository";
import type { ICertificateAuthorityIssuerPort, InitializeInternalCertificateAuthorityInput, InitializeInternalCertificateAuthorityResult, IssueCertificateMaterialInput, IssueCertificateMaterialResult, RevokeCertificateMaterialInput, RevokeCertificateMaterialResult } from "../../../application/security/ports/ICertificateAuthorityIssuerPort";
import type { ITrustMaterialReferencePersistenceRepository } from "../../../application/security/ports/ITrustMaterialReferencePersistenceRepository";

const OIDS = Object.freeze({
  commonName: "2.5.4.3",
  organization: "2.5.4.10",
  organizationalUnit: "2.5.4.11",
  country: "2.5.4.6",
  stateOrProvince: "2.5.4.8",
  locality: "2.5.4.7",
  basicConstraints: "2.5.29.19",
  keyUsage: "2.5.29.15",
  subjectAltName: "2.5.29.17",
  extKeyUsage: "2.5.29.37",
  subjectKeyIdentifier: "2.5.29.14",
  authorityKeyIdentifier: "2.5.29.35",
  rsaSha256: "1.2.840.113549.1.1.11",
  rsaSha384: "1.2.840.113549.1.1.12",
  rsaSha512: "1.2.840.113549.1.1.13",
  ed25519: "1.3.101.112",
  ekuServerAuth: "1.3.6.1.5.5.7.3.1",
  ekuClientAuth: "1.3.6.1.5.5.7.3.2",
});

type SignatureProfile = Readonly<{
  kind: "rsa" | "ed25519";
  algorithmIdentifierOid: string;
  hashAlgorithm?: "sha256" | "sha384" | "sha512";
  displayName: string;
}>;

export interface InternalCertificateAuthorityIssuerDependencies {
  readonly certificateAuthorityRepository: ICertificateAuthorityRootPersistenceRepository;
  readonly trustMaterialRepository: ITrustMaterialReferencePersistenceRepository;
  readonly rootMaterialStorage: ICertificateAuthorityRootMaterialStorage;
}

export class InternalCertificateAuthorityIssuer implements ICertificateAuthorityIssuerPort {
  public constructor(private readonly dependencies: InternalCertificateAuthorityIssuerDependencies) {}

  public async initializeInternalCertificateAuthority(
    input: InitializeInternalCertificateAuthorityInput,
  ): Promise<InitializeInternalCertificateAuthorityResult> {
    const validityDays = normalizeValidityDays(input.validityDays, "certificate authority");
    const signatureProfile = resolveSignatureProfile(input.signatureAlgorithm);
    const now = new Date();
    const validity = createValidityWindow(now, validityDays);
    const serialNumber = createSerialNumberHex();
    const subject = normalizeSubject(input.subject);
    const keyPair = generateIssuerKeyPair(signatureProfile);

    const rootCertificateDer = createSignedCertificateDer({
      serialNumberHex: serialNumber,
      issuer: subject,
      subject,
      subjectPublicKeySpkiDer: toSpkiDer(keyPair.publicKeyPem),
      issuerPrivateKeyPem: keyPair.privateKeyPem,
      signatureProfile,
      notBefore: validity.notBefore,
      notAfter: validity.notAfter,
      isCertificateAuthority: true,
      usages: [],
      authorityKeyIdentifier: undefined,
    });

    const rootCertificatePem = toPemBlock("CERTIFICATE", rootCertificateDer);
    const rootFingerprint = createSha256Fingerprint(rootCertificateDer);

    return Object.freeze({
      certificateAuthorityId: normalizeRequired(input.certificateAuthorityId, "certificateAuthorityId"),
      serialNumber,
      notBefore: validity.notBefore.toISOString(),
      notAfter: validity.notAfter.toISOString(),
      rootCertificatePem,
      encryptedRootPrivateKeyPem: keyPair.privateKeyPem,
      rootCertificateFingerprintSha256: rootFingerprint,
    });
  }

  public async issueCertificateMaterial(input: IssueCertificateMaterialInput): Promise<IssueCertificateMaterialResult> {
    const certificateAuthorityId = normalizeRequired(input.certificateAuthorityId, "certificateAuthorityId");
    const validityDays = normalizeValidityDays(input.validityDays, "issued certificate");
    const ca = await this.dependencies.certificateAuthorityRepository.findCertificateAuthorityById(certificateAuthorityId);
    if (!ca) {
      throw new Error(`Certificate authority '${certificateAuthorityId}' was not found.`);
    }
    if (ca.status !== CertificateAuthorityStatuses.active) {
      throw new Error(`Certificate authority '${certificateAuthorityId}' must be active for issuance.`);
    }

    const now = new Date();
    const caNotBefore = new Date(ca.validity.notBefore);
    const caNotAfter = new Date(ca.validity.notAfter);
    if (now < caNotBefore || now >= caNotAfter) {
      throw new Error(`Certificate authority '${certificateAuthorityId}' is outside its validity window.`);
    }

    const rootCertificateMaterial = await this.dependencies.trustMaterialRepository.findTrustMaterialByRef(
      ca.rootCertificateMaterialRef,
    );
    const rootPrivateKeyMaterial = await this.dependencies.trustMaterialRepository.findTrustMaterialByRef(
      ca.rootPrivateKeyMaterialRef,
    );
    if (!rootCertificateMaterial || !rootPrivateKeyMaterial) {
      throw new Error(`Certificate authority '${certificateAuthorityId}' root trust material metadata is incomplete.`);
    }

    const loaded = await this.dependencies.rootMaterialStorage.loadRootMaterials({
      certificateAuthorityId: ca.certificateAuthorityId,
      reason: "issue-certificate-material",
      materials: [
        {
          materialRef: rootCertificateMaterial.materialRef,
          kind: TrustMaterialKinds.certificatePem,
          secretRef: rootCertificateMaterial.storageLocator,
        },
        {
          materialRef: rootPrivateKeyMaterial.materialRef,
          kind: TrustMaterialKinds.privateKeyEncryptedPem,
          secretRef: rootPrivateKeyMaterial.storageLocator,
        },
      ],
    });

    const rootCertificatePem = findLoadedMaterial(loaded, rootCertificateMaterial.materialRef);
    const rootPrivateKeyPem = findLoadedMaterial(loaded, rootPrivateKeyMaterial.materialRef);
    const rootFingerprint = createSha256Fingerprint(toDerFromPem(rootCertificatePem, "CERTIFICATE"));

    const signatureProfile = resolveSignatureProfile(input.signatureAlgorithm ?? ca.signatureAlgorithm);
    const subject = normalizeSubject(input.subject);
    const subjectPublicKeySpkiDer = toSpkiDer(normalizeRequired(input.publicKeyPem, "publicKeyPem"));
    const serialNumber = createSerialNumberHex();
    const validity = createValidityWindowWithinCa(now, validityDays, caNotAfter);

    const leafCertificateDer = createSignedCertificateDer({
      serialNumberHex: serialNumber,
      issuer: normalizeSubject(ca.subject),
      subject,
      subjectPublicKeySpkiDer,
      issuerPrivateKeyPem: rootPrivateKeyPem,
      signatureProfile,
      notBefore: validity.notBefore,
      notAfter: validity.notAfter,
      isCertificateAuthority: false,
      usages: input.usages,
      authorityKeyIdentifier: rootFingerprint,
    });

    const certificatePem = toPemBlock("CERTIFICATE", leafCertificateDer);
    const certificateFingerprintSha256 = createSha256Fingerprint(leafCertificateDer);
    const certificateChainPem = ensureTrailingNewline(rootCertificatePem);

    return Object.freeze({
      certificateAuthorityId: ca.certificateAuthorityId,
      serialNumber,
      notBefore: validity.notBefore.toISOString(),
      notAfter: validity.notAfter.toISOString(),
      certificatePem,
      certificateChainPem,
      certificateFingerprintSha256,
    });
  }

  public async revokeCertificateMaterial(input: RevokeCertificateMaterialInput): Promise<RevokeCertificateMaterialResult> {
    const revokedAt = normalizeTimestamp(input.revokedAt ?? new Date().toISOString(), "revokedAt");
    return Object.freeze({
      certificateAuthorityId: normalizeRequired(input.certificateAuthorityId, "certificateAuthorityId"),
      serialNumber: normalizeRequired(input.serialNumber, "serialNumber").toUpperCase(),
      revokedAt,
    });
  }
}

function createSignedCertificateDer(input: {
  readonly serialNumberHex: string;
  readonly issuer: CertificateSubjectDescriptor;
  readonly subject: CertificateSubjectDescriptor;
  readonly subjectPublicKeySpkiDer: Buffer;
  readonly issuerPrivateKeyPem: string;
  readonly signatureProfile: SignatureProfile;
  readonly notBefore: Date;
  readonly notAfter: Date;
  readonly isCertificateAuthority: boolean;
  readonly usages: ReadonlyArray<CertificateUsageKind>;
  readonly authorityKeyIdentifier?: string;
}): Buffer {
  const subjectKeyIdentifier = createHash("sha1").update(input.subjectPublicKeySpkiDer).digest();
  const tbsCertificate = derSequence([
    derContextExplicit(0, derInteger(Buffer.from([0x02]))),
    derInteger(Buffer.from(input.serialNumberHex, "hex")),
    derAlgorithmIdentifier(input.signatureProfile),
    derName(input.issuer),
    derValidity(input.notBefore, input.notAfter),
    derName(input.subject),
    input.subjectPublicKeySpkiDer,
    derContextExplicit(3, derSequence(createExtensions({
      isCertificateAuthority: input.isCertificateAuthority,
      usages: input.usages,
      subject: input.subject,
      subjectKeyIdentifier,
      authorityKeyIdentifier: input.authorityKeyIdentifier,
    }))),
  ]);

  const signature = signTbsCertificate(tbsCertificate, input.issuerPrivateKeyPem, input.signatureProfile);
  return derSequence([
    tbsCertificate,
    derAlgorithmIdentifier(input.signatureProfile),
    derBitString(signature),
  ]);
}

function createExtensions(input: {
  readonly isCertificateAuthority: boolean;
  readonly usages: ReadonlyArray<CertificateUsageKind>;
  readonly subject: CertificateSubjectDescriptor;
  readonly subjectKeyIdentifier: Buffer;
  readonly authorityKeyIdentifier?: string;
}): ReadonlyArray<Buffer> {
  const extensions: Buffer[] = [];
  extensions.push(derExtension(OIDS.basicConstraints, true, derSequence([
    derBoolean(input.isCertificateAuthority),
  ])));

  const keyUsageBytes = input.isCertificateAuthority
    ? encodeKeyUsageBitString(["keyCertSign", "cRLSign"])
    : encodeKeyUsageBitString(resolveLeafKeyUsageBits(input.usages));
  extensions.push(derExtension(OIDS.keyUsage, true, keyUsageBytes));

  if (!input.isCertificateAuthority) {
    const ekuOids = resolveExtendedKeyUsages(input.usages);
    if (ekuOids.length > 0) {
      extensions.push(derExtension(
        OIDS.extKeyUsage,
        false,
        derSequence(ekuOids.map((oid) => derObjectIdentifier(oid))),
      ));
    }
  }

  const subjectAltName = derSubjectAltName(input.subject);
  if (subjectAltName) {
    extensions.push(derExtension(OIDS.subjectAltName, false, subjectAltName));
  }

  extensions.push(derExtension(
    OIDS.subjectKeyIdentifier,
    false,
    derOctetString(input.subjectKeyIdentifier),
  ));

  if (input.authorityKeyIdentifier) {
    const authorityKeyIdentifier = Buffer.from(input.authorityKeyIdentifier, "hex");
    extensions.push(derExtension(
      OIDS.authorityKeyIdentifier,
      false,
      derSequence([
        derContextPrimitive(0, authorityKeyIdentifier),
      ]),
    ));
  }

  return Object.freeze(extensions);
}

function resolveLeafKeyUsageBits(usages: ReadonlyArray<CertificateUsageKind>): ReadonlyArray<string> {
  const bits = new Set<string>(["digitalSignature"]);
  if (usages.includes("server-auth")) {
    bits.add("keyEncipherment");
  }
  return Object.freeze([...bits.values()]);
}

function resolveExtendedKeyUsages(usages: ReadonlyArray<CertificateUsageKind>): ReadonlyArray<string> {
  const eku = new Set<string>();
  if (usages.includes("server-auth") || usages.includes("mutual-tls")) {
    eku.add(OIDS.ekuServerAuth);
  }
  if (
    usages.includes("client-auth")
    || usages.includes("mutual-tls")
    || usages.includes("node-enrollment")
    || usages.includes("service-identity")
    || usages.includes("device-trust")
  ) {
    eku.add(OIDS.ekuClientAuth);
  }
  return Object.freeze([...eku.values()]);
}

function generateIssuerKeyPair(signatureProfile: SignatureProfile): {
  readonly privateKeyPem: string;
  readonly publicKeyPem: string;
} {
  if (signatureProfile.kind === "ed25519") {
    const pair = generateKeyPairSync("ed25519");
    return Object.freeze({
      privateKeyPem: pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
      publicKeyPem: pair.publicKey.export({ format: "pem", type: "spki" }).toString(),
    });
  }

  const pair = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicExponent: 0x10001,
  });
  return Object.freeze({
    privateKeyPem: pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    publicKeyPem: pair.publicKey.export({ format: "pem", type: "spki" }).toString(),
  });
}

function signTbsCertificate(tbsCertificateDer: Buffer, privateKeyPem: string, profile: SignatureProfile): Buffer {
  if (profile.kind === "ed25519") {
    return signOneShot(null, tbsCertificateDer, createPrivateKey(privateKeyPem));
  }

  const signer = createSign(profile.hashAlgorithm ?? "sha256");
  signer.update(tbsCertificateDer);
  signer.end();
  return signer.sign(createPrivateKey(privateKeyPem));
}

function derExtension(oid: string, critical: boolean, valueDer: Buffer): Buffer {
  const elements = [
    derObjectIdentifier(oid),
    ...(critical ? [derBoolean(true)] : []),
    derOctetString(valueDer),
  ];
  return derSequence(elements);
}

function derName(subject: CertificateSubjectDescriptor): Buffer {
  const rdns: Buffer[] = [];
  appendRdn(rdns, OIDS.commonName, subject.commonName);
  appendRdn(rdns, OIDS.organization, subject.organization);
  appendRdn(rdns, OIDS.organizationalUnit, subject.organizationalUnit);
  appendRdn(rdns, OIDS.country, subject.country, true);
  appendRdn(rdns, OIDS.stateOrProvince, subject.stateOrProvince);
  appendRdn(rdns, OIDS.locality, subject.locality);

  if (rdns.length === 0) {
    throw new Error("Certificate subject must contain at least one distinguished name component.");
  }

  return derSequence(rdns);
}

function appendRdn(target: Buffer[], oid: string, value?: string, printable = false): void {
  const normalized = value?.trim();
  if (!normalized) {
    return;
  }

  target.push(derSet([
    derSequence([
      derObjectIdentifier(oid),
      printable ? derPrintableString(normalized) : derUtf8String(normalized),
    ]),
  ]));
}

function derSubjectAltName(subject: CertificateSubjectDescriptor): Buffer | undefined {
  const entries: Buffer[] = [];
  for (const dns of subject.dnsNames) {
    const normalized = dns.trim().toLowerCase();
    if (normalized) {
      entries.push(derContextPrimitive(2, Buffer.from(normalized, "ascii")));
    }
  }
  for (const ipAddress of subject.ipAddresses) {
    const ipBytes = parseIpAddress(ipAddress.trim());
    if (ipBytes) {
      entries.push(derContextPrimitive(7, ipBytes));
    }
  }
  for (const uri of subject.uriSanEntries) {
    const normalized = uri.trim();
    if (normalized) {
      entries.push(derContextPrimitive(6, Buffer.from(normalized, "ascii")));
    }
  }

  if (entries.length === 0) {
    return undefined;
  }
  return derSequence(entries);
}

function parseIpAddress(value: string): Buffer | undefined {
  const kind = isIP(value);
  if (kind === 4) {
    const octets = value.split(".").map((entry) => Number.parseInt(entry, 10));
    if (octets.length === 4 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)) {
      return Buffer.from(octets);
    }
    return undefined;
  }
  if (kind !== 6) {
    return undefined;
  }

  const [left, right] = value.toLowerCase().split("::");
  const leftParts = left ? left.split(":").filter(Boolean) : [];
  const rightParts = right ? right.split(":").filter(Boolean) : [];
  const missingBlocks = 8 - (leftParts.length + rightParts.length);
  const middle = missingBlocks > 0 ? new Array<string>(missingBlocks).fill("0") : [];
  const parts = [...leftParts, ...middle, ...rightParts];
  if (parts.length !== 8) {
    return undefined;
  }

  const bytes: number[] = [];
  for (const part of parts) {
    const normalized = part.padStart(4, "0");
    const high = Number.parseInt(normalized.slice(0, 2), 16);
    const low = Number.parseInt(normalized.slice(2, 4), 16);
    if (Number.isNaN(high) || Number.isNaN(low)) {
      return undefined;
    }
    bytes.push(high, low);
  }
  return Buffer.from(bytes);
}

function derValidity(notBefore: Date, notAfter: Date): Buffer {
  return derSequence([
    derGeneralizedTime(notBefore),
    derGeneralizedTime(notAfter),
  ]);
}

function derAlgorithmIdentifier(profile: SignatureProfile): Buffer {
  if (profile.kind === "ed25519") {
    return derSequence([derObjectIdentifier(profile.algorithmIdentifierOid)]);
  }
  return derSequence([derObjectIdentifier(profile.algorithmIdentifierOid), derNull()]);
}

function toDerFromPem(pem: string, label: string): Buffer {
  const start = `-----BEGIN ${label}-----`;
  const end = `-----END ${label}-----`;
  const startIndex = pem.indexOf(start);
  const endIndex = pem.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error(`PEM block '${label}' was not found.`);
  }

  const body = pem.slice(startIndex + start.length, endIndex).replace(/\s+/g, "");
  return Buffer.from(body, "base64");
}

function toPemBlock(label: string, der: Buffer): string {
  const base64 = der.toString("base64");
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

function toSpkiDer(publicKeyPem: string): Buffer {
  return createPublicKey(publicKeyPem).export({
    format: "der",
    type: "spki",
  }) as Buffer;
}

function createSha256Fingerprint(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function createSerialNumberHex(): string {
  const serial = randomBytes(20);
  serial[0] = serial[0] & 0x7f;
  if (serial[0] === 0) {
    serial[0] = 1;
  }
  return serial.toString("hex").toUpperCase();
}

function normalizeSubject(subject: CertificateSubjectDescriptor): CertificateSubjectDescriptor {
  return Object.freeze({
    commonName: normalizeRequired(subject.commonName, "subject.commonName"),
    organization: normalizeOptional(subject.organization),
    organizationalUnit: normalizeOptional(subject.organizationalUnit),
    country: normalizeOptional(subject.country)?.toUpperCase(),
    stateOrProvince: normalizeOptional(subject.stateOrProvince),
    locality: normalizeOptional(subject.locality),
    dnsNames: Object.freeze([...new Set((subject.dnsNames ?? []).map((entry) => entry.trim()).filter(Boolean))]),
    ipAddresses: Object.freeze([...new Set((subject.ipAddresses ?? []).map((entry) => entry.trim()).filter(Boolean))]),
    uriSanEntries: Object.freeze([...new Set((subject.uriSanEntries ?? []).map((entry) => entry.trim()).filter(Boolean))]),
  });
}

function createValidityWindow(now: Date, validityDays: number): {
  readonly notBefore: Date;
  readonly notAfter: Date;
} {
  const notBefore = new Date(now.getTime() - (5 * 60 * 1000));
  const notAfter = new Date(now.getTime() + (validityDays * 24 * 60 * 60 * 1000));
  return Object.freeze({ notBefore, notAfter });
}

function createValidityWindowWithinCa(now: Date, validityDays: number, caNotAfter: Date): {
  readonly notBefore: Date;
  readonly notAfter: Date;
} {
  const notBefore = new Date(now.getTime() - (5 * 60 * 1000));
  const requestedNotAfter = new Date(now.getTime() + (validityDays * 24 * 60 * 60 * 1000));
  const notAfter = requestedNotAfter < caNotAfter ? requestedNotAfter : caNotAfter;
  if (notAfter <= now) {
    throw new Error("Issued certificate validity window would be empty after CA validity clamping.");
  }
  return Object.freeze({ notBefore, notAfter });
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function normalizeValidityDays(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} validityDays must be an integer >= 1.`);
  }
  return value;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: string, field: string): string {
  const normalized = value.trim();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function resolveSignatureProfile(signatureAlgorithm: string): SignatureProfile {
  const normalized = normalizeRequired(signatureAlgorithm, "signatureAlgorithm").toLowerCase();
  if (normalized === "sha256withrsaencryption") {
    return Object.freeze({
      kind: "rsa",
      algorithmIdentifierOid: OIDS.rsaSha256,
      hashAlgorithm: "sha256",
      displayName: "sha256WithRSAEncryption",
    });
  }
  if (normalized === "sha384withrsaencryption") {
    return Object.freeze({
      kind: "rsa",
      algorithmIdentifierOid: OIDS.rsaSha384,
      hashAlgorithm: "sha384",
      displayName: "sha384WithRSAEncryption",
    });
  }
  if (normalized === "sha512withrsaencryption") {
    return Object.freeze({
      kind: "rsa",
      algorithmIdentifierOid: OIDS.rsaSha512,
      hashAlgorithm: "sha512",
      displayName: "sha512WithRSAEncryption",
    });
  }
  if (normalized === "ed25519") {
    return Object.freeze({
      kind: "ed25519",
      algorithmIdentifierOid: OIDS.ed25519,
      displayName: "ed25519",
    });
  }

  throw new Error(`Unsupported certificate signatureAlgorithm '${signatureAlgorithm}'.`);
}

function findLoadedMaterial(
  loaded: ReadonlyArray<{
    readonly materialRef: string;
    readonly plaintextValue: string;
  }>,
  materialRef: string,
): string {
  const found = loaded.find((entry) => entry.materialRef === materialRef);
  if (!found) {
    throw new Error(`Expected loaded material '${materialRef}' was not returned by root material storage.`);
  }
  return found.plaintextValue;
}

function derBoolean(value: boolean): Buffer {
  return derTag(0x01, Buffer.from([value ? 0xff : 0x00]));
}

function derInteger(value: Buffer): Buffer {
  let normalized = Buffer.from(value);
  if (normalized.length === 0) {
    normalized = Buffer.from([0x00]);
  }
  while (normalized.length > 1 && normalized[0] === 0x00 && (normalized[1] & 0x80) === 0) {
    normalized = normalized.slice(1);
  }
  if ((normalized[0] & 0x80) !== 0) {
    normalized = Buffer.concat([Buffer.from([0x00]), normalized]);
  }
  return derTag(0x02, normalized);
}

function derBitString(value: Buffer): Buffer {
  return derTag(0x03, Buffer.concat([Buffer.from([0x00]), value]));
}

function derOctetString(value: Buffer): Buffer {
  return derTag(0x04, value);
}

function derNull(): Buffer {
  return derTag(0x05, Buffer.alloc(0));
}

function derObjectIdentifier(oid: string): Buffer {
  const parts = oid.split(".").map((entry) => Number.parseInt(entry, 10));
  if (parts.length < 2 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Invalid object identifier '${oid}'.`);
  }
  const first = (parts[0] * 40) + parts[1];
  const bytes = [first, ...parts.slice(2).flatMap(encodeOidPart)];
  return derTag(0x06, Buffer.from(bytes));
}

function encodeOidPart(value: number): number[] {
  if (value < 128) {
    return [value];
  }
  const bytes: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    bytes.unshift(remaining & 0x7f);
    remaining >>= 7;
  }
  for (let index = 0; index < bytes.length - 1; index += 1) {
    bytes[index] = bytes[index] | 0x80;
  }
  return bytes;
}

function derUtf8String(value: string): Buffer {
  return derTag(0x0c, Buffer.from(value, "utf8"));
}

function derPrintableString(value: string): Buffer {
  return derTag(0x13, Buffer.from(value, "ascii"));
}

function derGeneralizedTime(value: Date): Buffer {
  const iso = value.toISOString();
  const normalized = iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return derTag(0x18, Buffer.from(normalized, "ascii"));
}

function derSequence(elements: ReadonlyArray<Buffer>): Buffer {
  return derTag(0x30, Buffer.concat(elements));
}

function derSet(elements: ReadonlyArray<Buffer>): Buffer {
  return derTag(0x31, Buffer.concat(elements));
}

function derContextExplicit(tagNumber: number, value: Buffer): Buffer {
  return derTag(0xa0 + tagNumber, value);
}

function derContextPrimitive(tagNumber: number, value: Buffer): Buffer {
  return derTag(0x80 + tagNumber, value);
}

function derTag(tag: number, value: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(value.length), value]);
}

function derLength(length: number): Buffer {
  if (length < 0x80) {
    return Buffer.from([length]);
  }
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function encodeKeyUsageBitString(flags: ReadonlyArray<string>): Buffer {
  const bitIndexes: Record<string, number> = Object.freeze({
    digitalSignature: 0,
    nonRepudiation: 1,
    keyEncipherment: 2,
    dataEncipherment: 3,
    keyAgreement: 4,
    keyCertSign: 5,
    cRLSign: 6,
    encipherOnly: 7,
    decipherOnly: 8,
  });

  let highest = 0;
  for (const flag of flags) {
    const bit = bitIndexes[flag];
    if (typeof bit === "number" && bit > highest) {
      highest = bit;
    }
  }

  const totalBits = highest + 1;
  const byteLength = Math.max(1, Math.ceil(totalBits / 8));
  const bytes = Buffer.alloc(byteLength, 0);
  for (const flag of flags) {
    const bit = bitIndexes[flag];
    if (typeof bit !== "number") {
      continue;
    }
    const byteIndex = Math.floor(bit / 8);
    const bitInByte = bit % 8;
    bytes[byteIndex] = bytes[byteIndex] | (1 << (7 - bitInByte));
  }

  return derBitString(bytes);
}
