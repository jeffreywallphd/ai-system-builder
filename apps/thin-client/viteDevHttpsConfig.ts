import { readFileSync } from "node:fs";

type ThinClientViteHttpsEnvironment = Partial<Record<
  | "AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED"
  | "AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH"
  | "AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH",
  string
>>;

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function isThinClientViteHttpsEnabled(
  environment: ThinClientViteHttpsEnvironment = process.env,
): boolean {
  return isEnabled(environment.AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED);
}

function requirePath(value: string | undefined, variableName: string): string {
  const trimmedPath = value?.trim();
  if (!trimmedPath) {
    throw new Error(`${variableName} is required when AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED=true.`);
  }

  return trimmedPath;
}

function readRequiredPemFile(path: string, variableName: string, includePathInError: boolean): Buffer {
  try {
    return readFileSync(path);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown read error";
    if (includePathInError) {
      throw new Error(`${variableName} could not be read at \"${path}\": ${reason}`);
    }
    throw new Error(`${variableName} could not be read.`);
  }
}

function validateCertificatePemShape(contents: Buffer, variableName: string): void {
  const pemText = contents.toString("utf8");
  if (!pemText.includes("-----BEGIN CERTIFICATE-----")) {
    throw new Error(`${variableName} must point to a PEM certificate file containing -----BEGIN CERTIFICATE-----.`);
  }
}

function validatePrivateKeyPemShape(contents: Buffer, variableName: string): void {
  const pemText = contents.toString("utf8");
  const hasSupportedHeader = [
    "-----BEGIN PRIVATE KEY-----",
    "-----BEGIN RSA PRIVATE KEY-----",
    "-----BEGIN EC PRIVATE KEY-----",
  ].some((header) => pemText.includes(header));

  if (!hasSupportedHeader) {
    throw new Error(
      `${variableName} must point to a PEM private key file with a supported BEGIN header.`,
    );
  }
}

export function resolveThinClientViteHttpsConfig(
  environment: ThinClientViteHttpsEnvironment = process.env,
): false | { cert: Buffer; key: Buffer } {
  if (!isThinClientViteHttpsEnabled(environment)) {
    return false;
  }

  const certPath = requirePath(
    environment.AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH,
    "AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH",
  );
  const keyPath = requirePath(
    environment.AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH,
    "AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH",
  );

  const cert = readRequiredPemFile(certPath, "AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH", true);
  const key = readRequiredPemFile(keyPath, "AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH", false);
  validateCertificatePemShape(cert, "AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH");
  validatePrivateKeyPemShape(key, "AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH");

  return {
    cert,
    key,
  };
}
