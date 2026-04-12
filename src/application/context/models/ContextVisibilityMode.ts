export const CONTEXT_VISIBILITY_MODES = Object.freeze(["basic", "advanced"] as const);

export type ContextVisibilityMode = (typeof CONTEXT_VISIBILITY_MODES)[number];

export function isContextVisibilityMode(value: unknown): value is ContextVisibilityMode {
  return typeof value === "string" && CONTEXT_VISIBILITY_MODES.includes(value as ContextVisibilityMode);
}
