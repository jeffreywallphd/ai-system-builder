import type { EffectiveAssetProjectionDiagnosticCode, EffectiveAssetProjectionPolicy, EffectiveAssetProjectionSourceKind } from "../../../contracts/effective-asset-projections";
import { defaultEffectiveAssetProjectionDiagnosticsService } from "./effective-asset-projection-diagnostics.service";

type ValidationContext = {
  targetWorkspaceId?: string;
  sourceWorkspaceId?: string;
  sourceKind: EffectiveAssetProjectionSourceKind;
  policy: EffectiveAssetProjectionPolicy;
  projectedFieldsBlocked?: boolean;
  metadataSafe?: boolean;
  sourceMutationImplied?: "system"|"linked"|"import";
};

const SUPPORTED_POLICIES = new Set<EffectiveAssetProjectionPolicy>(["safe-fields-only", "draft-preview-only", "blocked"]);

export class EffectiveAssetProjectionValidationService {
  validate(context: ValidationContext): { ok: true } | { ok: false; code: EffectiveAssetProjectionDiagnosticCode } {
    if (!context.targetWorkspaceId) return { ok: false, code: "effective-projection-workspace-required" };
    if (context.sourceWorkspaceId && context.sourceWorkspaceId !== context.targetWorkspaceId) return { ok: false, code: "effective-projection-conflict-detected" };
    if (!SUPPORTED_POLICIES.has(context.policy)) return { ok: false, code: "effective-projection-policy-unsupported" };
    if (context.projectedFieldsBlocked) return { ok: false, code: "effective-projection-unsafe-field" };
    if (context.metadataSafe === false) return { ok: false, code: "effective-projection-unsafe-field" };
    if (context.sourceMutationImplied === "system") return { ok: false, code: "effective-projection-system-source-immutable" };
    if (context.sourceMutationImplied === "linked") return { ok: false, code: "effective-projection-linked-source-not-mutated" };
    if (context.sourceMutationImplied === "import") return { ok: false, code: "effective-projection-import-source-detached" };
    return { ok: true };
  }

  asDiagnostics(code: EffectiveAssetProjectionDiagnosticCode) {
    return {
      diagnostics: [defaultEffectiveAssetProjectionDiagnosticsService.createDiagnostic(code)],
      blockers: [defaultEffectiveAssetProjectionDiagnosticsService.createBlocker(code)],
    };
  }
}
export const defaultEffectiveAssetProjectionValidationService = new EffectiveAssetProjectionValidationService();
