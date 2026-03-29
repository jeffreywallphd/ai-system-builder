import {
  createEmptyWorkflowDraft,
  deserializeWorkflowDraft,
  serializeWorkflowDraft,
  type WorkflowDraft,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  createDefaultWorkflowStudioModeRegistry,
  DEFAULT_WORKFLOW_STUDIO_MODE_ID,
  type WorkflowStudioModeDefinition,
  type WorkflowStudioModeId,
} from "./WorkflowStudioModes";
import {
  validateWorkflowStudioModeState,
  type WorkflowStudioModeValidationIssue,
} from "./WorkflowStudioModeValidation";
import type { WorkflowValidationIssue } from "../../../domain/workflow-studio/WorkflowStudioDomain";

export interface WorkflowStudioDraftSyncContext {
  readonly studioId: string;
  readonly sessionId?: string;
  readonly draftId?: string;
  readonly revision?: number;
}

export interface WorkflowStudioModeState {
  readonly availableModes: ReadonlyArray<WorkflowStudioModeDefinition>;
  readonly selectedModeId: WorkflowStudioModeId;
  readonly selectedMode: WorkflowStudioModeDefinition;
  readonly sharedDraft: WorkflowDraft;
  readonly sharedDraftSerialized: string;
  readonly draftEditorContent: string;
  readonly draftParseError?: string;
  readonly modeValidationIssues: ReadonlyArray<WorkflowStudioModeValidationIssue>;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly hasModeValidationErrors: boolean;
  readonly isSharedDraftValid: boolean;
  readonly draftSyncContext?: WorkflowStudioDraftSyncContext;
  readonly hasLocalDraftEdits: boolean;
}

export type WorkflowStudioModeStateListener = (state: WorkflowStudioModeState) => void;

const defaultModeRegistry = createDefaultWorkflowStudioModeRegistry();

function buildInitialState(): WorkflowStudioModeState {
  const availableModes = defaultModeRegistry.list();
  const defaultDraft = createEmptyWorkflowDraft();
  const selectedMode = defaultModeRegistry.get(DEFAULT_WORKFLOW_STUDIO_MODE_ID) ?? availableModes[0];
  const serializedDefaultDraft = serializeWorkflowDraft(defaultDraft);

  if (!selectedMode) {
    throw new Error("Workflow studio mode registry must include at least one mode.");
  }

  return Object.freeze({
    availableModes,
    selectedModeId: selectedMode.id,
    selectedMode,
    sharedDraft: defaultDraft,
    sharedDraftSerialized: serializedDefaultDraft,
    draftEditorContent: serializedDefaultDraft,
    draftParseError: undefined,
    modeValidationIssues: Object.freeze([]),
    draftValidationIssues: Object.freeze([]),
    hasModeValidationErrors: false,
    isSharedDraftValid: true,
    draftSyncContext: undefined,
    hasLocalDraftEdits: false,
  });
}

function freezeState(state: WorkflowStudioModeState): WorkflowStudioModeState {
  const modeValidation = validateWorkflowStudioModeState({
    selectedModeId: state.selectedModeId,
    selectedModeDefinitionId: state.selectedMode.id,
    availableModeIds: state.availableModes.map((mode) => mode.id),
    sharedDraft: state.sharedDraft,
    draftParseError: state.draftParseError,
  });

  return Object.freeze({
    ...state,
    availableModes: Object.freeze([...(state.availableModes ?? [])]),
    sharedDraft: Object.freeze({
      ...state.sharedDraft,
      triggers: Object.freeze([...(state.sharedDraft.triggers ?? [])]),
      inputs: Object.freeze([...(state.sharedDraft.inputs ?? [])]),
      steps: Object.freeze([...(state.sharedDraft.steps ?? [])]),
      outputs: Object.freeze([...(state.sharedDraft.outputs ?? [])]),
    }),
    modeValidationIssues: Object.freeze([...(modeValidation.issues ?? [])]),
    draftValidationIssues: Object.freeze([...(modeValidation.draftIssues ?? [])]),
    hasModeValidationErrors: modeValidation.hasErrors,
    isSharedDraftValid: modeValidation.draftIsValid,
  });
}

export class WorkflowStudioModeStateStore {
  private readonly listeners = new Set<WorkflowStudioModeStateListener>();
  private state: WorkflowStudioModeState;

  constructor() {
    this.state = freezeState(buildInitialState());
  }

  public getState(): WorkflowStudioModeState {
    return this.state;
  }

  public subscribe(listener: WorkflowStudioModeStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setSelectedMode(modeId: WorkflowStudioModeId): void {
    const nextMode = this.state.availableModes.find((entry) => entry.id === modeId);
    if (!nextMode) {
      throw new Error(`Workflow studio mode '${modeId}' is not registered.`);
    }

    this.patch({
      selectedModeId: nextMode.id,
      selectedMode: nextMode,
    });
  }

  public replaceSharedDraft(sharedDraft: WorkflowDraft): void {
    this.replaceSharedDraftWithSerialized(sharedDraft, undefined, true);
  }

  public synchronizeSharedDraftFromSnapshot(input: {
    readonly serializedDraft: string;
    readonly context: WorkflowStudioDraftSyncContext;
  }): void {
    const snapshotSerializedDraft = input.serializedDraft;
    const contextChanged = !this.isSameDraftSyncContext(input.context, this.state.draftSyncContext);
    const snapshotMatchesLocal = snapshotSerializedDraft === this.state.draftEditorContent
      || snapshotSerializedDraft === this.state.sharedDraftSerialized;

    if (contextChanged || snapshotMatchesLocal || !this.state.hasLocalDraftEdits) {
      try {
        const sharedDraft = deserializeWorkflowDraft(snapshotSerializedDraft);
        this.replaceSharedDraftWithSerialized(sharedDraft, snapshotSerializedDraft, false, input.context);
      } catch (error) {
        this.patch({
          draftEditorContent: snapshotSerializedDraft,
          draftParseError: error instanceof Error ? error.message : "Workflow draft is malformed.",
          hasLocalDraftEdits: true,
          draftSyncContext: input.context,
        });
      }
      return;
    }

    this.patch({
      draftSyncContext: input.context,
    });
  }

  public updateSharedDraft(updater: (draft: WorkflowDraft) => WorkflowDraft): void {
    this.replaceSharedDraft(updater(this.state.sharedDraft));
  }

  public hydrateFromSerializedDraft(serializedDraft: string): void {
    try {
      const sharedDraft = deserializeWorkflowDraft(serializedDraft);
      this.replaceSharedDraftWithSerialized(sharedDraft, serializedDraft, true);
      return;
    } catch (error) {
      this.patch({
        draftEditorContent: serializedDraft,
        draftParseError: error instanceof Error ? error.message : "Workflow draft is malformed.",
        hasLocalDraftEdits: true,
      });
    }
  }

  private replaceSharedDraftWithSerialized(
    sharedDraft: WorkflowDraft,
    serializedDraft?: string,
    hasLocalDraftEdits = true,
    draftSyncContext?: WorkflowStudioDraftSyncContext,
  ): void {
    const serialized = serializeWorkflowDraft(sharedDraft);
    this.patch({
      sharedDraft: deserializeWorkflowDraft(serialized),
      sharedDraftSerialized: serialized,
      draftEditorContent: serializedDraft ?? serialized,
      draftParseError: undefined,
      hasLocalDraftEdits,
      draftSyncContext: draftSyncContext ?? this.state.draftSyncContext,
    });
  }

  private isSameDraftSyncContext(
    left: WorkflowStudioDraftSyncContext,
    right?: WorkflowStudioDraftSyncContext,
  ): boolean {
    return left.studioId === right?.studioId
      && left.sessionId === right.sessionId
      && left.draftId === right.draftId;
  }

  private patch(patch: Partial<WorkflowStudioModeState>): void {
    this.state = freezeState({
      ...this.state,
      ...patch,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

const workflowModeStoresByStudioId = new Map<string, WorkflowStudioModeStateStore>();

export function getWorkflowStudioModeStateStore(studioId: string): WorkflowStudioModeStateStore {
  const existing = workflowModeStoresByStudioId.get(studioId);
  if (existing) {
    return existing;
  }

  const created = new WorkflowStudioModeStateStore();
  workflowModeStoresByStudioId.set(studioId, created);
  return created;
}

export function clearWorkflowStudioModeStateStoresForTests(): void {
  workflowModeStoresByStudioId.clear();
}
