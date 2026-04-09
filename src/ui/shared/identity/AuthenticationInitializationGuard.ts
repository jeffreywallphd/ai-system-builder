import type { LoginLocalIdentityApiResponse } from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";

export const DefaultAuthenticationInitializationTimeoutMs = 8_000;

export interface AuthenticationInitializationOutcome {
  readonly initialized: boolean;
  readonly timedOut: boolean;
}

export async function guardAuthenticationInitialization(
  onAuthenticated: (session: LoginLocalIdentityApiResponse) => boolean | Promise<boolean>,
  session: LoginLocalIdentityApiResponse,
  timeoutMs: number = DefaultAuthenticationInitializationTimeoutMs,
): Promise<AuthenticationInitializationOutcome> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let didTimeout = false;
  try {
    const initialized = await Promise.race<boolean>([
      Promise.resolve(onAuthenticated(session)),
      new Promise<boolean>((resolve) => {
        timeoutHandle = setTimeout(() => {
          didTimeout = true;
          resolve(false);
        }, normalizeTimeoutMs(timeoutMs));
      }),
    ]);

    if (initialized) {
      return Object.freeze({
        initialized: true,
        timedOut: false,
      });
    }

    return Object.freeze({
      initialized: false,
      timedOut: didTimeout,
    });
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function normalizeTimeoutMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DefaultAuthenticationInitializationTimeoutMs;
  }
  return Math.floor(value);
}
