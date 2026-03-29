import { isWorkflowStudioModeId } from "./WorkflowStudioModes";
import type { WorkflowStudioModeStateStore } from "./WorkflowStudioModeStateStore";
import { StudioReturnPayloadResolver } from "../../routes/StudioReturnPayloadResolution";

export interface WorkflowStudioReturnRestorationResult {
  readonly handled: boolean;
  readonly restored: boolean;
  readonly handoffId?: string;
}

export class WorkflowStudioReturnRestorationService {
  private readonly returnPayloadResolver: Pick<StudioReturnPayloadResolver, "resolveFromSearch">;

  public constructor(
    returnPayloadResolver: Pick<StudioReturnPayloadResolver, "resolveFromSearch"> = new StudioReturnPayloadResolver(),
  ) {
    this.returnPayloadResolver = returnPayloadResolver;
  }

  public restoreFromReturnSearch(input: {
    readonly search: string;
    readonly workflowModeStore: Pick<
      WorkflowStudioModeStateStore,
      "setSelectedMode" | "hydrateFromSerializedDraft" | "setDraftSyncContext"
    >;
  }): WorkflowStudioReturnRestorationResult {
    const resolution = this.returnPayloadResolver.resolveFromSearch(input.search);
    if (!resolution.handled) {
      return Object.freeze({
        handled: false,
        restored: false,
      });
    }

    const handoff = resolution.handoff;
    if (!handoff || handoff.origin.studioType !== "workflow-studio") {
      return Object.freeze({
        handled: true,
        restored: false,
        handoffId: handoff?.launch.handoffId,
      });
    }

    const workflowContext = handoff.origin.workflowAuthoring;
    const modeId = workflowContext?.modeId?.trim();
    if (modeId && isWorkflowStudioModeId(modeId)) {
      input.workflowModeStore.setSelectedMode(modeId);
    }

    const draftState = workflowContext?.draftState?.trim();
    if (draftState) {
      input.workflowModeStore.hydrateFromSerializedDraft(draftState);
    }

    const draftReference = workflowContext?.draftReference;
    if (draftReference?.studioId?.trim()) {
      input.workflowModeStore.setDraftSyncContext({
        studioId: draftReference.studioId,
        sessionId: draftReference.sessionId,
        draftId: draftReference.draftId,
      });
    }

    return Object.freeze({
      handled: true,
      restored: true,
      handoffId: handoff.launch.handoffId,
    });
  }
}
