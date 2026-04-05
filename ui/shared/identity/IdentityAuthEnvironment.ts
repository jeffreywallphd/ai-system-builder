import type { LoginLocalIdentityApiRequest } from "../../../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";

export function resolveIdentityAccessChannel(): NonNullable<LoginLocalIdentityApiRequest["accessChannel"]> {
  if (typeof window !== "undefined" && window.aiLoomDesktop) {
    return "desktop";
  }
  return "thin-client";
}

export function resolveIdentityClientContext(): LoginLocalIdentityApiRequest["client"] {
  if (typeof navigator === "undefined") {
    return undefined;
  }
  const userAgent = navigator.userAgent?.trim();
  if (!userAgent) {
    return undefined;
  }
  return Object.freeze({
    userAgent,
  });
}
