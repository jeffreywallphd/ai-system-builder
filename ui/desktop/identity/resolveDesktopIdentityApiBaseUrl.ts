export function resolveDesktopIdentityApiBaseUrl(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const configured = window.aiLoomDesktop?.bootstrap.runtimeConfig.identityApiBaseUrl;
  return configured?.trim() || undefined;
}
