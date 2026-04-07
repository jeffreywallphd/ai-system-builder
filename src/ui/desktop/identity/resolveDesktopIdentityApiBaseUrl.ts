import {
  HostSecureTransportKinds,
  assertSecureTransportEndpoint,
  resolveHostSecureTransportConfig,
} from "../../../src/infrastructure/config/HostSecureTransportConfig";

export function resolveDesktopIdentityApiBaseUrl(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const configured = window.aiLoomDesktop?.bootstrap.runtimeConfig.identityApiBaseUrl;
  const normalized = configured?.trim();
  if (!normalized) {
    return undefined;
  }
  return assertSecureTransportEndpoint(normalized, resolveHostSecureTransportConfig({
    hostKind: HostSecureTransportKinds.desktop,
    hostAddress: "127.0.0.1",
  }));
}
