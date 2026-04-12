import { createRequire } from "node:module";

export const DesktopOfflineValueProtectionPostures = Object.freeze({
  protectedAtRest: "protected-at-rest",
  unprotectedAtRest: "unprotected-at-rest",
});

export type DesktopOfflineValueProtectionPosture =
  typeof DesktopOfflineValueProtectionPostures[keyof typeof DesktopOfflineValueProtectionPostures];

export interface DesktopOfflineValueProtectionContext {
  readonly store: "offline-snapshot-cache" | "offline-pending-operation" | "offline-local-execution-registration";
  readonly field: string;
}

export interface DesktopOfflineValueProtectionPort {
  readonly posture: DesktopOfflineValueProtectionPosture;
  protect(value: string, context: DesktopOfflineValueProtectionContext): string;
  unprotect(value: string, context: DesktopOfflineValueProtectionContext): string;
}

interface ElectronSafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(buffer: Buffer): string;
}

const ProtectedValuePrefix = "offline-protected:v1:";

export function createUnprotectedDesktopOfflineValueProtectionPort(): DesktopOfflineValueProtectionPort {
  return Object.freeze({
    posture: DesktopOfflineValueProtectionPostures.unprotectedAtRest,
    protect: (value: string) => value,
    unprotect: (value: string) => value,
  });
}

export function createElectronSafeStorageDesktopOfflineValueProtectionPort(): DesktopOfflineValueProtectionPort {
  const safeStorage = resolveElectronSafeStorage();
  if (!safeStorage) {
    return createUnprotectedDesktopOfflineValueProtectionPort();
  }

  return Object.freeze({
    posture: DesktopOfflineValueProtectionPostures.protectedAtRest,
    protect: (value: string) => `${ProtectedValuePrefix}${safeStorage.encryptString(value).toString("base64")}`,
    unprotect: (value: string, context: DesktopOfflineValueProtectionContext) => {
      if (!value.startsWith(ProtectedValuePrefix)) {
        return value;
      }

      const encoded = value.slice(ProtectedValuePrefix.length);
      try {
        return safeStorage.decryptString(Buffer.from(encoded, "base64"));
      } catch {
        throw new Error(
          `Unable to decrypt protected offline value for ${context.store}.${context.field}.`,
        );
      }
    },
  });
}

function resolveElectronSafeStorage(): ElectronSafeStorageLike | undefined {
  try {
    const require = createRequire(import.meta.url);
    const electron = require("electron") as {
      readonly safeStorage?: ElectronSafeStorageLike;
    };
    if (!electron.safeStorage?.isEncryptionAvailable()) {
      return undefined;
    }
    return electron.safeStorage;
  } catch {
    return undefined;
  }
}
