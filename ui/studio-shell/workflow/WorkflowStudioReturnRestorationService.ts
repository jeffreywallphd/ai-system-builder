import { isWorkflowStudioModeId } from "./WorkflowStudioModes";
import type { WorkflowStudioModeStateStore } from "./WorkflowStudioModeStateStore";
import { StudioReturnPayloadResolver } from "../../routes/StudioReturnPayloadResolution";
import type { WorkflowDraftReference } from "../../routes/StudioHandoffContract";

export interface WorkflowStudioReturnRestorationResult {
  readonly handled: boolean;
  readonly restored: boolean;
  readonly handoffId?: string;
  readonly ignoredReason?: "draft-context-mismatch";
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
      "getState" | "setSelectedMode" | "hydrateFromSerializedDraft" | "setDraftSyncContext"
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
    const handoffDraftReference = workflowContext?.draftReference;
    const currentDraftSyncContext = input.workflowModeStore.getState().draftSyncContext;
    if (
      handoffDraftReference
      && currentDraftSyncContext
      && this.isDraftContextMismatch(currentDraftSyncContext, handoffDraftReference)
    ) {
      return Object.freeze({
        handled: true,
        restored: false,
        handoffId: handoff.launch.handoffId,
        ignoredReason: "draft-context-mismatch",
      });
    }

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

  private isDraftContextMismatch(
    currentContext: NonNullable<ReturnType<WorkflowStudioModeStateStore["getState"]>["draftSyncContext"]>,
    handoffReference: WorkflowDraftReference,
  ): boolean {
    if (currentContext.studioId.trim() !== handoffReference.studioId.trim()) {
      return true;
    }

    const currentSessionId = currentContext.sessionId?.trim();
    const handoffSessionId = handoffReference.sessionId?.trim();
    if (currentSessionId && handoffSessionId && currentSessionId !== handoffSessionId) {
      return true;
    }

    const currentDraftId = currentContext.draftId?.trim();
    const handoffDraftId = handoffReference.draftId?.trim();
    if (currentDraftId && handoffDraftId && currentDraftId !== handoffDraftId) {
      return true;
    }

    return false;
  }
}
