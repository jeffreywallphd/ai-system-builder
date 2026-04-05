import {
  HostSecureTransportKinds,
  assertSecureTransportEndpoint,
  resolveHostSecureTransportConfig,
} from "../../../infrastructure/config/HostSecureTransportConfig";

export function resolveWebIdentityApiBaseUrl(): string {
  const configured = import.meta.env.VITE_IDENTITY_API_BASE_URL as string | undefined;
  const fallback = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5174";
  const endpoint = configured?.trim() || fallback;
  const config = resolveHostSecureTransportConfig({
    hostKind: HostSecureTransportKinds.web,
  });
  return assertSecureTransportEndpoint(endpoint, config);
}
