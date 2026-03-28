import type { StudioInitializationContext } from "../../application/studio-entry/StudioEntryContracts";
import type { BuildIntent, BuildIntentSelection } from "./BuildIntentModels";
import type { BuildIntentFlowTarget, BuildIntentRouteDecision } from "./BuildIntentRouting";
import type { InlineAssetCreationReturnTarget } from "./InlineAssetCreation";

export const BuildFlowTransitionKinds = Object.freeze({
  intentRouted: "intent-routed",
  modeChanged: "mode-changed",
  assetLinked: "asset-linked",
  resumed: "resumed",
});

export type BuildFlowTransitionKind = typeof BuildFlowTransitionKinds[keyof typeof BuildFlowTransitionKinds];

export interface BuildFlowTransition {
  readonly kind: BuildFlowTransitionKind;
  readonly timestampIso: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface BuildFlowResumeContext {
  readonly returnTarget?: InlineAssetCreationReturnTarget;
  readonly resumePath?: string;
  readonly resumedAtIso?: string;
}

export interface BuildFlowAssetReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly relation: "opened" | "created" | "supporting";
}

export interface BuildFlowState {
  readonly intent: BuildIntent;
  readonly flowTarget: BuildIntentFlowTarget;
  readonly launchContext: StudioInitializationContext;
  readonly progress: "intent-selected" | "launching" | "active" | "paused";
  readonly relatedAssets: ReadonlyArray<BuildFlowAssetReference>;
  readonly resumeContext?: BuildFlowResumeContext;
}

export interface BuildFlowSession {
  readonly sessionId: string;
  readonly selection: BuildIntentSelection;
  readonly current: BuildFlowState;
  readonly transitions: ReadonlyArray<BuildFlowTransition>;
}

function freezeTransition(transition: BuildFlowTransition): BuildFlowTransition {
  return Object.freeze({ ...transition, metadata: transition.metadata ? Object.freeze({ ...transition.metadata }) : undefined });
}

function freezeState(state: BuildFlowState): BuildFlowState {
  return Object.freeze({
    ...state,
    launchContext: Object.freeze({ ...state.launchContext }),
    relatedAssets: Object.freeze(state.relatedAssets.map((asset) => Object.freeze({ ...asset }))),
    resumeContext: state.resumeContext ? Object.freeze({ ...state.resumeContext }) : undefined,
  });
}

function freezeSession(session: BuildFlowSession): BuildFlowSession {
  return Object.freeze({
    sessionId: session.sessionId,
    selection: Object.freeze({ ...session.selection }),
    current: freezeState(session.current),
    transitions: Object.freeze(session.transitions.map((transition) => freezeTransition(transition))),
  });
}

export class BuildFlowStateStore {
  private readonly sessions = new Map<string, BuildFlowSession>();

  public save(session: BuildFlowSession): BuildFlowSession {
    const frozen = freezeSession(session);
    this.sessions.set(session.sessionId, frozen);
    return frozen;
  }

  public get(sessionId: string): BuildFlowSession | undefined {
    return this.sessions.get(sessionId);
  }
}

function createSessionId(selection: BuildIntentSelection): string {
  const timestamp = selection.selectedAtIso.replace(/[^0-9]/g, "");
  return `build-flow-${selection.intent}-${timestamp}`;
}

export class BuildFlowContextService {
  constructor(private readonly store = new BuildFlowStateStore()) {}

  public startSessionFromRouteDecision(selection: BuildIntentSelection, decision: BuildIntentRouteDecision): BuildFlowSession {
    const session: BuildFlowSession = {
      sessionId: createSessionId(selection),
      selection,
      current: {
        intent: selection.intent,
        flowTarget: decision.target,
        launchContext: decision.studioEntry.initializationPayload.initialization.context,
        progress: "active",
        relatedAssets: [],
      },
      transitions: [
        {
          kind: BuildFlowTransitionKinds.intentRouted,
          timestampIso: selection.selectedAtIso,
          metadata: {
            target: decision.target,
            reason: decision.routingReason,
          },
        },
      ],
    };

    return this.store.save(session);
  }

  public linkAsset(sessionId: string, asset: BuildFlowAssetReference): BuildFlowSession | undefined {
    const session = this.store.get(sessionId);
    if (!session) {
      return undefined;
    }

    const updated: BuildFlowSession = {
      ...session,
      current: {
        ...session.current,
        relatedAssets: [...session.current.relatedAssets, asset],
      },
      transitions: [...session.transitions, {
        kind: BuildFlowTransitionKinds.assetLinked,
        timestampIso: new Date().toISOString(),
        metadata: {
          assetId: asset.assetId,
          relation: asset.relation,
        },
      }],
    };
    return this.store.save(updated);
  }

  public setResumeContext(sessionId: string, resumeContext: BuildFlowResumeContext): BuildFlowSession | undefined {
    const session = this.store.get(sessionId);
    if (!session) {
      return undefined;
    }

    const updated: BuildFlowSession = {
      ...session,
      current: {
        ...session.current,
        progress: "paused",
        resumeContext,
      },
      transitions: [...session.transitions, {
        kind: BuildFlowTransitionKinds.modeChanged,
        timestampIso: new Date().toISOString(),
        metadata: {
          progress: "paused",
        },
      }],
    };

    return this.store.save(updated);
  }

  public resumeSession(sessionId: string, resumePath: string): BuildFlowSession | undefined {
    const session = this.store.get(sessionId);
    if (!session) {
      return undefined;
    }

    const resumedAtIso = new Date().toISOString();
    const updated: BuildFlowSession = {
      ...session,
      current: {
        ...session.current,
        progress: "active",
        resumeContext: {
          ...session.current.resumeContext,
          resumePath,
          resumedAtIso,
        },
      },
      transitions: [...session.transitions, {
        kind: BuildFlowTransitionKinds.resumed,
        timestampIso: resumedAtIso,
        metadata: {
          resumePath,
        },
      }],
    };

    return this.store.save(updated);
  }

  public getSession(sessionId: string): BuildFlowSession | undefined {
    return this.store.get(sessionId);
  }
}
