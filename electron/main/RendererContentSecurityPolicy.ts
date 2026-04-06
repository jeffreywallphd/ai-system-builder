import type { AppRuntimeConfigValues } from "../../infrastructure/config/AppRuntimeConfig";

const SELF_SOURCE = "'self'";
const UNSAFE_INLINE_SOURCE = "'unsafe-inline'";

interface RendererContentSecurityPolicyOptions {
  readonly rendererDevUrl: string;
  readonly runtimeConfig?: AppRuntimeConfigValues;
}

function normalizeOrigin(input: string | undefined): string | undefined {
  const normalized = input?.trim();
  if (!normalized) {
    return undefined;
  }

  try {
    return new URL(normalized).origin;
  } catch {
    return undefined;
  }
}

function resolveWebsocketOrigin(origin: string): string | undefined {
  try {
    const url = new URL(origin);
    if (url.protocol === "http:") {
      url.protocol = "ws:";
      return url.origin;
    }
    if (url.protocol === "https:") {
      url.protocol = "wss:";
      return url.origin;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function resolveHttpOrigins(options: RendererContentSecurityPolicyOptions): ReadonlyArray<string> {
  const origins = new Set<string>();
  const runtimeConfig = options.runtimeConfig;
  const includeRendererOrigin = !runtimeConfig || runtimeConfig.rendererDeliveryMode === "dev-server";
  if (includeRendererOrigin) {
    const rendererOrigin = normalizeOrigin(options.rendererDevUrl);
    if (rendererOrigin) {
      origins.add(rendererOrigin);
    }
  }

  if (!runtimeConfig) {
    return [...origins];
  }

  const identityOrigin = normalizeOrigin(runtimeConfig.identityApiBaseUrl);
  if (identityOrigin) {
    origins.add(identityOrigin);
  }

  const serviceSupervisorOrigin = normalizeOrigin(runtimeConfig.serviceSupervisorBaseUrl);
  if (serviceSupervisorOrigin) {
    origins.add(serviceSupervisorOrigin);
  }

  return [...origins];
}

function joinSources(sources: ReadonlyArray<string>): string {
  return sources.join(" ");
}

export function createRendererContentSecurityPolicy(options: RendererContentSecurityPolicyOptions): string {
  const httpOrigins = resolveHttpOrigins(options);
  const connectOrigins = new Set<string>([SELF_SOURCE, ...httpOrigins]);
  for (const httpOrigin of httpOrigins) {
    const websocketOrigin = resolveWebsocketOrigin(httpOrigin);
    if (websocketOrigin) {
      connectOrigins.add(websocketOrigin);
    }
  }

  const scriptSources = joinSources([SELF_SOURCE, UNSAFE_INLINE_SOURCE, ...httpOrigins]);
  const connectSources = joinSources([...connectOrigins]);
  const imageSources = joinSources([SELF_SOURCE, "data:", "blob:", ...httpOrigins]);
  const mediaSources = joinSources([SELF_SOURCE, "blob:", ...httpOrigins]);

  return [
    `default-src ${SELF_SOURCE}`,
    `script-src ${scriptSources}`,
    `connect-src ${connectSources}`,
    `style-src ${SELF_SOURCE} ${UNSAFE_INLINE_SOURCE}`,
    `img-src ${imageSources}`,
    `media-src ${mediaSources}`,
    `font-src ${SELF_SOURCE} data:`,
    "object-src 'none'",
    `base-uri ${SELF_SOURCE}`,
    "frame-ancestors 'none'",
  ].join("; ");
}
