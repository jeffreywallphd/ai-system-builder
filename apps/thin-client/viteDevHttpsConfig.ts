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

function readRequiredPemFile(path: string, variableName: string): Buffer {
  try {
    return readFileSync(path);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown read error";
    throw new Error(`${variableName} could not be read at \"${path}\": ${reason}`);
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

  return {
    cert: readRequiredPemFile(certPath, "AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH"),
    key: readRequiredPemFile(keyPath, "AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH"),
  };
}
