import { constants, readFileSync } from "node:fs";
import { accessSync } from "node:fs";
import type { ServerOptions } from "node:https";

function validatePath(label: "AI_SYSTEM_BUILDER_TLS_CERT_PATH" | "AI_SYSTEM_BUILDER_TLS_KEY_PATH", value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} is required when HTTPS is enabled. Set ${label} to a readable PEM file path.`);
  }
  try {
    accessSync(normalized, constants.R_OK);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unreadable";
    throw new Error(`${label} is not readable at '${normalized}'. Fix the path and ensure read permission. (${message})`);
  }
  return normalized;
}

export function createHttpsServerOptions(certPathInput: string | undefined, keyPathInput: string | undefined): ServerOptions {
  const certPath = validatePath("AI_SYSTEM_BUILDER_TLS_CERT_PATH", certPathInput);
  const keyPath = validatePath("AI_SYSTEM_BUILDER_TLS_KEY_PATH", keyPathInput);
  try {
    return { cert: readFileSync(certPath), key: readFileSync(keyPath) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown read failure";
    throw new Error(`Failed to load HTTPS certificate/key files. Verify PEM contents and permissions. (${message})`);
  }
}
