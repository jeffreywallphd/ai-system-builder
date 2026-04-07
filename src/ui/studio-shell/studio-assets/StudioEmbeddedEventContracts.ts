export const StudioEmbeddedIntentKinds = Object.freeze({
  openResource: "studio.intent.open-resource",
  requestFullView: "studio.intent.request-full-view",
  selectionChange: "studio.intent.selection-change",
  commitRequest: "studio.intent.commit-request",
  applyRequest: "studio.intent.apply-request",
});

export type StudioEmbeddedIntentKind = typeof StudioEmbeddedIntentKinds[keyof typeof StudioEmbeddedIntentKinds];

interface StudioEmbeddedIntentBase<TKind extends StudioEmbeddedIntentKind, TPayload> {
  readonly kind: TKind;
  readonly payload: TPayload;
}

export type StudioOpenResourceIntent = StudioEmbeddedIntentBase<
  typeof StudioEmbeddedIntentKinds.openResource,
  {
    readonly resourceType: "dataset" | "workflow" | "page" | "item";
    readonly resourceId: string;
    readonly focus?: string;
  }
>;

export type StudioRequestFullViewIntent = StudioEmbeddedIntentBase<
  typeof StudioEmbeddedIntentKinds.requestFullView,
  {
    readonly reason: "details" | "editing" | "run-results";
  }
>;

export type StudioSelectionChangeIntent = StudioEmbeddedIntentBase<
  typeof StudioEmbeddedIntentKinds.selectionChange,
  {
    readonly targetType: "wizard-page" | "canvas-node" | "panel" | "item";
    readonly targetId?: string;
  }
>;

export type StudioCommitRequestIntent = StudioEmbeddedIntentBase<
  typeof StudioEmbeddedIntentKinds.commitRequest,
  {
    readonly scope: "draft" | "selection";
  }
>;

export type StudioApplyRequestIntent = StudioEmbeddedIntentBase<
  typeof StudioEmbeddedIntentKinds.applyRequest,
  {
    readonly scope: "changes" | "configuration";
  }
>;

export type StudioEmbeddedIntent =
  | StudioOpenResourceIntent
  | StudioRequestFullViewIntent
  | StudioSelectionChangeIntent
  | StudioCommitRequestIntent
  | StudioApplyRequestIntent;

export interface StudioEmbeddedEvent {
  readonly type: "studio.intent";
  readonly intent: StudioEmbeddedIntent;
}

export interface StudioEmbeddedEventEnvelope {
  readonly event: StudioEmbeddedEvent;
  readonly source: {
    readonly studioType: string;
    readonly studioId: string;
    readonly hostId: string;
    readonly mode: string;
  };
}

export function createStudioIntentEvent(intent: StudioEmbeddedIntent): StudioEmbeddedEvent {
  return Object.freeze({
    type: "studio.intent",
    intent,
  });
}
