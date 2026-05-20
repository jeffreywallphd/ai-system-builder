import type { EffectiveAssetProjectionDiagnosticId, EffectiveAssetProjectionBlockerId } from "./effective-asset-projection-identity";

export type EffectiveAssetProjectionDiagnosticCode =
  | "effective-projection-workspace-required" | "effective-projection-source-required" | "effective-projection-source-missing" | "effective-projection-source-unsupported"
  | "effective-projection-conflict-detected" | "effective-projection-disabled-override" | "effective-projection-draft-not-execution-ready"
  | "effective-projection-unsafe-field" | "effective-projection-field-unsupported" | "effective-projection-policy-unsupported"
  | "effective-projection-system-source-immutable" | "effective-projection-linked-source-not-mutated" | "effective-projection-import-source-detached"
  | "effective-projection-materialization-unavailable";

export type EffectiveAssetProjectionDiagnostic = { diagnosticId?: EffectiveAssetProjectionDiagnosticId; code: EffectiveAssetProjectionDiagnosticCode; message: string; metadata?: Record<string, string | number | boolean | null> };
export type EffectiveAssetProjectionBlocker = { blockerId?: EffectiveAssetProjectionBlockerId; code: EffectiveAssetProjectionDiagnosticCode; message: string; };
export const normalizeEffectiveAssetProjectionDiagnostic = (value: EffectiveAssetProjectionDiagnostic): EffectiveAssetProjectionDiagnostic => ({ ...value, message: "Sanitized projection diagnostic." });
export const normalizeEffectiveAssetProjectionBlocker = (value: EffectiveAssetProjectionBlocker): EffectiveAssetProjectionBlocker => ({ ...value, message: "Sanitized projection blocker." });
