import { UxRunActionKinds, type UxRunActionKind, type UxRunContext, type UxRunRequest, UxRuntimeService } from "../runtime/UxRuntimeService";
import type { AssetActionContext } from "./AssetIntentActions";

export interface InlineRunAction {
  readonly type: UxRunActionKind;
  readonly label: string;
  readonly enabled: boolean;
  readonly reason?: string;
}

export interface InlineRunRequest {
  readonly action: UxRunActionKind;
  readonly target: {
    readonly kind: "asset" | "system" | "tool" | "general";
    readonly assetId?: string;
    readonly versionId?: string;
  };
  readonly context: UxRunContext;
}

export interface InlineRunResult {
  readonly launchPath: string;
  readonly runRequest: UxRunRequest;
}

function canRunOrTest(role?: string): boolean {
  return role === "workflow" || role === "agent" || role === "system" || role === "tool-chain";
}

export class InlineRunActionResolver {
  public resolveForAsset(context: AssetActionContext): ReadonlyArray<InlineRunAction> {
    const enabled = canRunOrTest(context.asset.taxonomy?.semanticRole);
    const reason = enabled ? undefined : "Execution is not available for this asset.";
    return Object.freeze([
      Object.freeze({ type: UxRunActionKinds.run, label: "Run here", enabled, reason }),
      Object.freeze({ type: UxRunActionKinds.test, label: "Test here", enabled, reason }),
    ]);
  }
}

export class InlineRunLaunchService {
  private readonly uxRuntimeService = new UxRuntimeService();

  public launch(request: InlineRunRequest): InlineRunResult {
    const runRequest: UxRunRequest = Object.freeze({
      action: request.action,
      target: request.target,
      context: request.context,
    });
    return Object.freeze({
      runRequest,
      launchPath: this.uxRuntimeService.resolveRunSurfacePath(runRequest),
    });
  }
}
