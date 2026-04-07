import {
  HostSecureTransportKinds,
  assertSecureTransportEndpoint,
  resolveHostSecureTransportConfig,
} from "../../../infrastructure/config/HostSecureTransportConfig";
import { AppRuntimeConfig } from "../../../infrastructure/config/AppRuntimeConfig";

export function resolveWebIdentityApiBaseUrl(): string {
  const runtimeConfigBaseUrl = AppRuntimeConfig.resolveDefault().identityApiBaseUrl;
  const configured = import.meta.env.VITE_IDENTITY_API_BASE_URL as string | undefined;
  const fallback = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5174";
  const endpoint = runtimeConfigBaseUrl?.trim() || configured?.trim() || fallback;
  const config = resolveHostSecureTransportConfig({
    hostKind: HostSecureTransportKinds.web,
  });
  return assertSecureTransportEndpoint(endpoint, config);
}
