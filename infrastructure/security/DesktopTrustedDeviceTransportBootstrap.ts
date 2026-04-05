import type { DesktopBootstrapContext } from "../../electron/shared/DesktopContracts";

export const DesktopTrustedDeviceBootstrapFailureReasons = Object.freeze({
  registrationMissing: "registration-missing",
  pinnedTrustMaterialMissing: "pinned-trust-material-missing",
  pinnedTrustMaterialExpired: "pinned-trust-material-expired",
  sessionAssuranceNotTrusted: "session-assurance-not-trusted",
} as const);

export type DesktopTrustedDeviceBootstrapFailureReason =
  typeof DesktopTrustedDeviceBootstrapFailureReasons[keyof typeof DesktopTrustedDeviceBootstrapFailureReasons];

export type DesktopTrustedDeviceTransportBootstrapState =
  | {
    readonly status: "ready";
    readonly trustedDeviceBindingId: string;
    readonly trustMarker?: string;
    readonly pinnedTrustMaterial: {
      readonly pinReference: string;
      readonly materialKind: "session-signing-key" | "attestation-key" | "opaque-marker";
      readonly publicKeyFingerprint?: string;
      readonly issuedAt?: string;
      readonly expiresAt?: string;
    };
  }
  | {
    readonly status: "not-required";
  }
  | {
    readonly status: "failed";
    readonly reason: DesktopTrustedDeviceBootstrapFailureReason;
    readonly userMessage: string;
  };

export interface IDesktopTrustedDeviceBootstrapPort {
  getDesktopBootstrapContext(): DesktopBootstrapContext | undefined;
}

export interface IDesktopTrustedDeviceBootstrapClockPort {
  now(): Date;
}

interface ResolveDesktopTrustedDeviceTransportBootstrapInput {
  readonly bootstrapPort?: IDesktopTrustedDeviceBootstrapPort;
  readonly clock?: IDesktopTrustedDeviceBootstrapClockPort;
}

export function resolveDesktopTrustedDeviceTransportBootstrap(
  input: ResolveDesktopTrustedDeviceTransportBootstrapInput = {},
): DesktopTrustedDeviceTransportBootstrapState {
  const bootstrapPort = input.bootstrapPort ?? new WindowDesktopTrustedDeviceBootstrapPort();
  const clock = input.clock ?? SystemDesktopTrustedDeviceBootstrapClockPort;
  const bootstrap = bootstrapPort.getDesktopBootstrapContext();
  const trust = bootstrap?.identityTransportTrust;
  if (!trust) {
    return Object.freeze({ status: "not-required" });
  }

  if (trust.enforcement !== "required") {
    return Object.freeze({ status: "not-required" });
  }

  const trustedDeviceBindingId = trust.registeredDevice?.trustedDeviceBindingId?.trim();
  if (!trustedDeviceBindingId) {
    return failed(
      DesktopTrustedDeviceBootstrapFailureReasons.registrationMissing,
      "Trusted device registration is required before connecting this desktop client.",
    );
  }

  const pinReference = trust.pinnedTrustMaterial?.pinReference?.trim();
  if (!pinReference) {
    return failed(
      DesktopTrustedDeviceBootstrapFailureReasons.pinnedTrustMaterialMissing,
      "Pinned trust material is required before connecting this desktop client.",
    );
  }

  const expiresAt = normalizeOptional(trust.pinnedTrustMaterial?.expiresAt);
  if (expiresAt && Date.parse(expiresAt) <= clock.now().getTime()) {
    return failed(
      DesktopTrustedDeviceBootstrapFailureReasons.pinnedTrustMaterialExpired,
      "Pinned trust material has expired. Re-pair this desktop client to continue.",
    );
  }

  return Object.freeze({
    status: "ready",
    trustedDeviceBindingId,
    trustMarker: normalizeOptional(trust.registeredDevice?.trustMarker),
    pinnedTrustMaterial: Object.freeze({
      pinReference,
      materialKind: trust.pinnedTrustMaterial?.materialKind ?? "opaque-marker",
      publicKeyFingerprint: normalizeOptional(trust.pinnedTrustMaterial?.publicKeyFingerprint),
      issuedAt: normalizeOptional(trust.pinnedTrustMaterial?.issuedAt),
      expiresAt,
    }),
  });
}

export class WindowDesktopTrustedDeviceBootstrapPort implements IDesktopTrustedDeviceBootstrapPort {
  public getDesktopBootstrapContext(): DesktopBootstrapContext | undefined {
    if (typeof window === "undefined") {
      return undefined;
    }
    return window.aiLoomDesktop?.bootstrap;
  }
}

export const SystemDesktopTrustedDeviceBootstrapClockPort: IDesktopTrustedDeviceBootstrapClockPort = Object.freeze({
  now: () => new Date(),
});

function failed(
  reason: DesktopTrustedDeviceBootstrapFailureReason,
  userMessage: string,
): DesktopTrustedDeviceTransportBootstrapState {
  return Object.freeze({
    status: "failed",
    reason,
    userMessage,
  });
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
