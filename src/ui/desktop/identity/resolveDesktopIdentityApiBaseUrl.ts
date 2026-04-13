import {
  HostSecureTransportKinds,
  assertSecureTransportEndpoint,
  resolveHostSecureTransportConfig,
} from "@infrastructure/config/HostSecureTransportConfig";

export function resolveDesktopIdentityApiBaseUrl(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const configured = window.aiLoomDesktop?.auth?.controlPlane?.baseUrl
    ?? window.aiLoomDesktop?.auth?.bootstrapContext?.runtimeConfig?.controlPlaneBaseUrl
    ?? window.aiLoomDesktop?.bootstrapContext?.runtimeConfig?.controlPlaneBaseUrl
    ?? window.aiLoomDesktop?.auth?.bootstrap.runtimeConfig?.controlPlaneBaseUrl
    ?? window.aiLoomDesktop?.bootstrap?.runtimeConfig?.controlPlaneBaseUrl
    ?? window.aiLoomDesktop?.auth?.bootstrapContext?.runtimeConfig?.identityApiBaseUrl
    ?? window.aiLoomDesktop?.bootstrapContext?.runtimeConfig?.identityApiBaseUrl
    ?? window.aiLoomDesktop?.auth?.bootstrap.runtimeConfig?.identityApiBaseUrl
    ?? window.aiLoomDesktop?.bootstrap?.runtimeConfig?.identityApiBaseUrl;
  const normalized = configured?.trim();
  if (!normalized) {
    return undefined;
  }
  return assertSecureTransportEndpoint(normalized, resolveHostSecureTransportConfig({
    hostKind: HostSecureTransportKinds.desktop,
    hostAddress: "127.0.0.1",
  }));
}

