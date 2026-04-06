export const HostSecureTransportKinds = Object.freeze({
  server: "server",
  desktop: "desktop",
  hybrid: "hybrid",
  web: "web",
  worker: "worker",
});

export type HostSecureTransportKind =
  typeof HostSecureTransportKinds[keyof typeof HostSecureTransportKinds];

export interface HostSecureTransportConfig {
  readonly hostKind: HostSecureTransportKind;
  readonly allowInsecureLoopback: boolean;
  readonly requireSecureHttp: boolean;
  readonly requireSecureWebSocket: boolean;
  readonly enforceTransportTrustValidation: boolean;
  readonly websocketPolicy: {
    readonly allowLegacyWebSocket: boolean;
  };
  readonly trustMaterial: {
    readonly managedServerTlsEnabled: boolean;
    readonly serverReferenceId?: string;
    readonly privateKeyMaterialRef?: string;
  };
}

export interface ResolveHostSecureTransportConfigInput {
  readonly hostKind: HostSecureTransportKind;
  readonly hostAddress?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

const MANAGED_TLS_KEYS = Object.freeze({
  enabled: "AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED",
  serverReferenceId: "AI_LOOM_INTERNAL_CA_SERVER_REFERENCE_ID",
  privateKeyMaterialRef: "AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF",
});

const TRANSPORT_KEYS = Object.freeze({
  allowInsecureLoopback: "AI_LOOM_TRANSPORT_ALLOW_INSECURE_LOOPBACK",
  enforceTrustValidation: "AI_LOOM_TRANSPORT_TRUST_ENFORCEMENT",
});

export function resolveHostSecureTransportConfig(
  input: ResolveHostSecureTransportConfigInput,
): HostSecureTransportConfig {
  const env = input.env ?? resolveRuntimeEnvironment();
  const hostAddress = normalizeOptional(input.hostAddress);
  const loopbackHost = !hostAddress || isLoopbackHost(hostAddress);
  const managedServerTlsEnabled = parseBoolean(env[MANAGED_TLS_KEYS.enabled]) ?? false;
  const allowInsecureLoopback = (
    parseBoolean(env[TRANSPORT_KEYS.allowInsecureLoopback])
    ?? (input.hostKind !== HostSecureTransportKinds.web && loopbackHost)
  );
  const enforceTransportTrustValidation = parseBoolean(env[TRANSPORT_KEYS.enforceTrustValidation]) ?? true;

  return Object.freeze({
    hostKind: input.hostKind,
    allowInsecureLoopback,
    requireSecureHttp: managedServerTlsEnabled || !allowInsecureLoopback,
    requireSecureWebSocket: managedServerTlsEnabled || !allowInsecureLoopback,
    enforceTransportTrustValidation,
    websocketPolicy: Object.freeze({
      allowLegacyWebSocket: false,
    }),
    trustMaterial: Object.freeze({
      managedServerTlsEnabled,
      serverReferenceId: normalizeOptional(env[MANAGED_TLS_KEYS.serverReferenceId]),
      privateKeyMaterialRef: normalizeOptional(env[MANAGED_TLS_KEYS.privateKeyMaterialRef]),
    }),
  });
}

function resolveRuntimeEnvironment(): Readonly<Record<string, string | undefined>> {
  if (typeof globalThis === "undefined") {
    return Object.freeze({});
  }

  const processLike = (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process;

  return processLike?.env ?? Object.freeze({});
}

export function assertSecureTransportEndpoint(
  endpoint: string,
  config: HostSecureTransportConfig,
): string {
  const normalized = endpoint.trim();
  if (!normalized) {
    throw new Error("Secure transport endpoint is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Secure transport endpoint must be a valid absolute URL.");
  }

  const secureScheme = parsed.protocol === "https:" || parsed.protocol === "wss:";
  if (secureScheme) {
    return stripTrailingSlash(parsed.toString());
  }

  const localHttpAllowed = (
    (parsed.protocol === "http:" || parsed.protocol === "ws:")
    && config.allowInsecureLoopback
    && isLoopbackHost(parsed.hostname)
  );
  if (localHttpAllowed) {
    return stripTrailingSlash(parsed.toString());
  }

  throw new Error(
    `Insecure transport endpoint '${parsed.toString()}' is not allowed for host '${config.hostKind}'.`,
  );
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return undefined;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "localhost"
    || normalized === "::1"
    || normalized === "[::1]"
    || normalized === "127.0.0.1";
}
