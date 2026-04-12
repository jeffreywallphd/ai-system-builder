export const ThinClientFormFactors = Object.freeze({
  browser: "browser",
  mobileBrowser: "mobile-browser",
  mobileWebView: "mobile-webview",
  unknown: "unknown",
});

export type ThinClientFormFactor =
  typeof ThinClientFormFactors[keyof typeof ThinClientFormFactors];

export interface ThinClientSessionChannelContextDto {
  readonly accessChannel: "thin-client";
  readonly formFactor: ThinClientFormFactor;
  readonly mobile: boolean;
  readonly browserSurface: boolean;
  readonly origin?: string;
}

export interface ThinClientOriginPolicyEvaluationInput {
  readonly originHeader: string | undefined;
  readonly expectedHost: string | undefined;
}

export interface ThinClientOriginPolicyEvaluationResult {
  readonly accepted: boolean;
  readonly reason?:
    | "origin-required"
    | "origin-invalid"
    | "origin-host-mismatch"
    | "origin-scheme-not-allowed";
  readonly normalizedOrigin?: string;
}

export function resolveThinClientFormFactor(userAgent: string | undefined): ThinClientFormFactor {
  const normalized = userAgent?.toLowerCase() ?? "";
  if (!normalized) {
    return ThinClientFormFactors.unknown;
  }

  const isWebView = normalized.includes("wv")
    || normalized.includes("; wv")
    || normalized.includes(" webview")
    || normalized.includes("samsungbrowser/")
    || normalized.includes("fbav/")
    || normalized.includes("instagram");
  const isMobile = normalized.includes("mobile")
    || normalized.includes("android")
    || normalized.includes("iphone")
    || normalized.includes("ipad")
    || normalized.includes("ipod");

  if (isWebView && isMobile) {
    return ThinClientFormFactors.mobileWebView;
  }
  if (isMobile) {
    return ThinClientFormFactors.mobileBrowser;
  }
  return ThinClientFormFactors.browser;
}

export function buildThinClientSessionChannelContext(input: {
  readonly userAgent: string | undefined;
  readonly origin: string | undefined;
}): ThinClientSessionChannelContextDto {
  const formFactor = resolveThinClientFormFactor(input.userAgent);
  return Object.freeze({
    accessChannel: "thin-client",
    formFactor,
    mobile: formFactor === ThinClientFormFactors.mobileBrowser
      || formFactor === ThinClientFormFactors.mobileWebView,
    browserSurface: formFactor !== ThinClientFormFactors.unknown,
    origin: normalizeOptional(input.origin),
  });
}

export function evaluateThinClientWebSocketOriginPolicy(
  input: ThinClientOriginPolicyEvaluationInput,
): ThinClientOriginPolicyEvaluationResult {
  const originHeader = normalizeOptional(input.originHeader);
  if (!originHeader) {
    return Object.freeze({
      accepted: false,
      reason: "origin-required",
    });
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(originHeader);
  } catch {
    return Object.freeze({
      accepted: false,
      reason: "origin-invalid",
    });
  }

  const scheme = parsedOrigin.protocol.toLowerCase();
  const originHost = parsedOrigin.host.toLowerCase();
  const expectedHost = normalizeOptional(input.expectedHost)?.toLowerCase();

  const loopbackOrigin = isLoopbackHost(parsedOrigin.hostname);
  const allowedScheme = scheme === "https:" || (scheme === "http:" && loopbackOrigin);
  if (!allowedScheme) {
    return Object.freeze({
      accepted: false,
      reason: "origin-scheme-not-allowed",
    });
  }

  if (expectedHost && expectedHost !== originHost) {
    return Object.freeze({
      accepted: false,
      reason: "origin-host-mismatch",
    });
  }

  return Object.freeze({
    accepted: true,
    normalizedOrigin: parsedOrigin.origin,
  });
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "::1"
    || normalized === "[::1]";
}
