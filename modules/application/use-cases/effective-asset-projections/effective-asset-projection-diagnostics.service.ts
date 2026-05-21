import type { EffectiveAssetProjectionBlocker, EffectiveAssetProjectionDiagnostic, EffectiveAssetProjectionDiagnosticCode } from "../../../contracts/effective-asset-projections";
import { normalizeEffectiveAssetProjectionBlocker, normalizeEffectiveAssetProjectionDiagnostic } from "../../../contracts/effective-asset-projections";

export class EffectiveAssetProjectionDiagnosticsService {
  createDiagnostic(code: EffectiveAssetProjectionDiagnosticCode, metadata?: EffectiveAssetProjectionDiagnostic["metadata"]): EffectiveAssetProjectionDiagnostic {
    return normalizeEffectiveAssetProjectionDiagnostic({ code, message: "", metadata });
  }
  createBlocker(code: EffectiveAssetProjectionDiagnosticCode, metadata?: EffectiveAssetProjectionBlocker["metadata"]): EffectiveAssetProjectionBlocker {
    return normalizeEffectiveAssetProjectionBlocker({ code, message: "", metadata });
  }
}

export const defaultEffectiveAssetProjectionDiagnosticsService = new EffectiveAssetProjectionDiagnosticsService();
