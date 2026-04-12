/**
 * Desktop trust bootstrap coordinator for loading trust material, persisting consent state, and exposing trust-aware startup primitives.
 */
import process from "node:process";
import { safeStorage } from "electron";
import type { DesktopIdentityTransportTrustBootstrap } from "../shared/DesktopContracts";
import type { DesktopConnectivityProbePort } from "../../src/hosts/desktop/DesktopConnectivityStateService";

const IDENTITY_SESSION_STORAGE_KEY = "ai-loom.identity.session.v1";
const CONNECTIVITY_PROBE_TIMEOUT_MS = 1_750;

const DESKTOP_TRUST_STORAGE_KEYS = Object.freeze({
  trustedDeviceBindingId: "identity.desktop.transport.trusted-device-binding-id",
  trustMarker: "identity.desktop.transport.trust-marker",
  materialKind: "identity.desktop.transport.material-kind",
  pinReference: "identity.desktop.transport.pin-reference",
  publicKeyFingerprint: "identity.desktop.transport.public-key-fingerprint",
  issuedAt: "identity.desktop.transport.issued-at",
  expiresAt: "identity.desktop.transport.expires-at",
});

const DESKTOP_TRUST_ENV_KEYS = Object.freeze({
  enforcement: "AI_LOOM_DESKTOP_TRUST_BOOTSTRAP_ENFORCEMENT",
  trustedDeviceBindingId: "AI_LOOM_DESKTOP_TRUSTED_DEVICE_BINDING_ID",
  trustMarker: "AI_LOOM_DESKTOP_TRUST_MARKER",
  materialKind: "AI_LOOM_DESKTOP_TRUST_MATERIAL_KIND",
  pinReference: "AI_LOOM_DESKTOP_TRUST_PIN_REFERENCE",
  publicKeyFingerprint: "AI_LOOM_DESKTOP_TRUST_PUBLIC_KEY_FINGERPRINT",
  issuedAt: "AI_LOOM_DESKTOP_TRUST_ISSUED_AT",
  expiresAt: "AI_LOOM_DESKTOP_TRUST_EXPIRES_AT",
});

export function resolveDesktopIdentityTransportTrustBootstrap(readStorageItem: (key: string) => string | null): DesktopIdentityTransportTrustBootstrap | undefined {
  const enforcement = normalizeTrustBootstrapEnforcement(process.env[DESKTOP_TRUST_ENV_KEYS.enforcement]);
  const trustedDeviceBindingId = readDesktopTrustValue(readStorageItem, {
    storageKey: DESKTOP_TRUST_STORAGE_KEYS.trustedDeviceBindingId,
    envKey: DESKTOP_TRUST_ENV_KEYS.trustedDeviceBindingId,
  });
  const pinReference = readDesktopTrustSecretValue(readStorageItem, {
    storageKey: DESKTOP_TRUST_STORAGE_KEYS.pinReference,
    envKey: DESKTOP_TRUST_ENV_KEYS.pinReference,
  });

  const trustConfigured = Boolean(trustedDeviceBindingId || pinReference);
  const effectiveEnforcement = enforcement ?? (trustConfigured ? "required" : "optional");
  if (!trustConfigured && effectiveEnforcement !== "required") {
    return undefined;
  }

  const materialKind = normalizeMaterialKind(
    readDesktopTrustValue(readStorageItem, {
      storageKey: DESKTOP_TRUST_STORAGE_KEYS.materialKind,
      envKey: DESKTOP_TRUST_ENV_KEYS.materialKind,
    }),
  ) ?? "opaque-marker";

  return Object.freeze({
    enforcement: effectiveEnforcement,
    registeredDevice: trustedDeviceBindingId
      ? Object.freeze({
          trustedDeviceBindingId,
          trustMarker: readDesktopTrustSecretValue(readStorageItem, {
            storageKey: DESKTOP_TRUST_STORAGE_KEYS.trustMarker,
            envKey: DESKTOP_TRUST_ENV_KEYS.trustMarker,
          }),
        })
      : undefined,
    pinnedTrustMaterial: pinReference
      ? Object.freeze({
          pinReference,
          materialKind,
          publicKeyFingerprint: readDesktopTrustValue(readStorageItem, {
            storageKey: DESKTOP_TRUST_STORAGE_KEYS.publicKeyFingerprint,
            envKey: DESKTOP_TRUST_ENV_KEYS.publicKeyFingerprint,
          }),
          issuedAt: readDesktopTrustValue(readStorageItem, {
            storageKey: DESKTOP_TRUST_STORAGE_KEYS.issuedAt,
            envKey: DESKTOP_TRUST_ENV_KEYS.issuedAt,
          }),
          expiresAt: readDesktopTrustValue(readStorageItem, {
            storageKey: DESKTOP_TRUST_STORAGE_KEYS.expiresAt,
            envKey: DESKTOP_TRUST_ENV_KEYS.expiresAt,
          }),
        })
      : undefined,
  });
}

export function createDesktopConnectivityProbePort(identityApiBaseUrl: string, readStorageItem: (key: string) => string | null): DesktopConnectivityProbePort {
  return Object.freeze({
    probe: async () => {
      const trustBootstrap = resolveDesktopIdentityTransportTrustBootstrap(readStorageItem);
      const trustEnforcement = trustBootstrap?.enforcement ?? "optional";
      const trustPrerequisites = evaluateTrustPrerequisites(trustBootstrap);
      const trustedSession = resolveTrustedSessionAvailability(readStorageItem, trustEnforcement);
      const transport = await probeTransportReachability(identityApiBaseUrl);
      return Object.freeze({
        transportReachable: transport.transportReachable,
        transportTransientFailure: transport.transportTransientFailure,
        transportDetail: transport.transportDetail,
        trustedSessionAvailable: trustedSession.available,
        trustedSessionDetail: trustedSession.detail,
        trustPrerequisitesSatisfied: trustPrerequisites.satisfied,
        trustPrerequisitesDetail: trustPrerequisites.detail,
        trustEnforcement,
      });
    },
  });
}

export function normalizeHttpOrigin(value: string): string | undefined {
  try {
    const origin = new URL(value).origin;
    return origin === "null" ? undefined : origin;
  } catch {
    return undefined;
  }
}

function readDesktopTrustValue(readStorageItem: (key: string) => string | null, input: { readonly storageKey: string; readonly envKey: string; }): string | undefined {
  const fromStorage = normalizeOptional(readStorageItem(input.storageKey) ?? undefined);
  if (fromStorage) {
    return fromStorage;
  }
  return normalizeOptional(process.env[input.envKey]);
}

function readDesktopTrustSecretValue(readStorageItem: (key: string) => string | null, input: { readonly storageKey: string; readonly envKey: string; }): string | undefined {
  const encoded = readStorageItem(`secure:${input.storageKey}`);
  if (encoded) {
    try {
      const decrypted = safeStorage.decryptString(Buffer.from(encoded, "base64"));
      const normalized = normalizeOptional(decrypted);
      if (normalized) {
        return normalized;
      }
    } catch {
      // fall through
    }
  }
  return readDesktopTrustValue(readStorageItem, input);
}

function normalizeMaterialKind(value: string | undefined): "session-signing-key" | "attestation-key" | "opaque-marker" | undefined {
  if (value === "session-signing-key" || value === "attestation-key" || value === "opaque-marker") {
    return value;
  }
  return undefined;
}

function normalizeTrustBootstrapEnforcement(value: string | undefined): "required" | "optional" | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (normalized === "required" || normalized === "optional") {
    return normalized;
  }
  return undefined;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function evaluateTrustPrerequisites(
  bootstrap: DesktopIdentityTransportTrustBootstrap | undefined,
): { readonly satisfied: boolean; readonly detail?: string } {
  if (!bootstrap || bootstrap.enforcement !== "required") {
    return Object.freeze({ satisfied: true });
  }
  const trustedDeviceBindingId = normalizeOptional(bootstrap.registeredDevice?.trustedDeviceBindingId);
  const pinReference = normalizeOptional(bootstrap.pinnedTrustMaterial?.pinReference);
  const expiresAt = normalizeOptional(bootstrap.pinnedTrustMaterial?.expiresAt);
  if (!trustedDeviceBindingId || !pinReference) {
    return Object.freeze({
      satisfied: false,
      detail: !trustedDeviceBindingId
        ? "Trusted-device binding ID is missing from desktop trust bootstrap state."
        : "Pinned trust material reference is missing from desktop trust bootstrap state.",
    });
  }
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    return Object.freeze({
      satisfied: false,
      detail: `Pinned trust material expired at ${expiresAt}.`,
    });
  }
  return Object.freeze({ satisfied: true });
}

function resolveTrustedSessionAvailability(readStorageItem: (key: string) => string | null, trustEnforcement: "required" | "optional"): { readonly available: boolean; readonly detail?: string } {
  const payload = readStorageItem(IDENTITY_SESSION_STORAGE_KEY);
  if (!payload) {
    return Object.freeze({ available: false, detail: "No persisted authenticated session was found in desktop storage." });
  }
  try {
    const parsed = JSON.parse(payload) as { readonly sessionToken?: string; readonly sessionExpiresAt?: string; readonly sessionTrustState?: string };
    const sessionToken = normalizeOptional(parsed.sessionToken);
    if (!sessionToken) return Object.freeze({ available: false, detail: "Persisted desktop session is missing a session token." });
    const expiresAt = normalizeOptional(parsed.sessionExpiresAt);
    const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return Object.freeze({ available: false, detail: "Persisted desktop session is expired." });
    const trustState = normalizeOptional(parsed.sessionTrustState);
    if (trustEnforcement === "required" && trustState !== "trusted") return Object.freeze({ available: false, detail: "Persisted desktop session is not trusted under required trust enforcement." });
    if (trustState === "revoked" || trustState === "expired") return Object.freeze({ available: false, detail: `Persisted desktop session trust state '${trustState}' is not eligible for trusted operation.` });
    return Object.freeze({ available: true });
  } catch {
    return Object.freeze({ available: false, detail: "Persisted desktop session payload is invalid JSON." });
  }
}

async function probeTransportReachability(identityApiBaseUrl: string): Promise<{ readonly transportReachable: boolean; readonly transportTransientFailure?: boolean; readonly transportDetail?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONNECTIVITY_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(identityApiBaseUrl, { method: "GET", cache: "no-store", signal: controller.signal });
    return Object.freeze({ transportReachable: true, transportTransientFailure: false, transportDetail: `Authoritative server probe responded with HTTP ${response.status}.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connectivity probe error.";
    return Object.freeze({ transportReachable: false, transportTransientFailure: true, transportDetail: message });
  } finally {
    clearTimeout(timeout);
  }
}
