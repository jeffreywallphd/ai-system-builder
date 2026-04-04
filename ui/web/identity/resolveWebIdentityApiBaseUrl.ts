export function resolveWebIdentityApiBaseUrl(): string {
  const configured = import.meta.env.VITE_IDENTITY_API_BASE_URL as string | undefined;
  const fallback = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5174";
  return (configured?.trim() || fallback).replace(/\/$/, "");
}
