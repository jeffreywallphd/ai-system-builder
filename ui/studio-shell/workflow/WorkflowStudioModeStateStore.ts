import {
  createEmptyWorkflowDraft,
  deserializeWorkflowDraft,
  serializeWorkflowDraft,
  type WorkflowDraft,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  createDefaultWorkflowStudioModeRegistry,
  WorkflowStudioModeIds,
  type WorkflowStudioModeDefinition,
  type WorkflowStudioModeId,
} from "./WorkflowStudioModes";

export interface WorkflowStudioModeState {
  readonly availableModes: ReadonlyArray<WorkflowStudioModeDefinition>;
  readonly selectedModeId: WorkflowStudioModeId;
  readonly selectedMode: WorkflowStudioModeDefinition;
  readonly sharedDraft: WorkflowDraft;
  readonly sharedDraftSerialized: string;
  readonly draftEditorContent: string;
  readonly draftParseError?: string;
}

export type WorkflowStudioModeStateListener = (state: WorkflowStudioModeState) => void;

const defaultModeRegistry = createDefaultWorkflowStudioModeRegistry();

function buildInitialState(): WorkflowStudioModeState {
  const availableModes = defaultModeRegistry.list();
  const defaultDraft = createEmptyWorkflowDraft();
  const selectedMode = defaultModeRegistry.get(WorkflowStudioModeIds.canvas) ?? availableModes[0];

  if (!selectedMode) {
    throw new Error("Workflow studio mode registry must include at least one mode.");
  }

  return Object.freeze({
    availableModes,
    selectedModeId: selectedMode.id,
    selectedMode,
    sharedDraft: defaultDraft,
    sharedDraftSerialized: serializeWorkflowDraft(defaultDraft),
    draftEditorContent: serializeWorkflowDraft(defaultDraft),
    draftParseError: undefined,
  });
}

function freezeState(state: WorkflowStudioModeState): WorkflowStudioModeState {
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
  });
}

export class WorkflowStudioModeStateStore {
  private readonly listeners = new Set<WorkflowStudioModeStateListener>();
  private state: WorkflowStudioModeState;

  constructor() {
    this.state = buildInitialState();
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
    const serialized = serializeWorkflowDraft(sharedDraft);
    this.patch({
      sharedDraft: deserializeWorkflowDraft(serialized),
      sharedDraftSerialized: serialized,
      draftEditorContent: serialized,
      draftParseError: undefined,
    });
  }

  public updateSharedDraft(updater: (draft: WorkflowDraft) => WorkflowDraft): void {
    this.replaceSharedDraft(updater(this.state.sharedDraft));
  }

  public hydrateFromSerializedDraft(serializedDraft: string): void {
    try {
      const sharedDraft = deserializeWorkflowDraft(serializedDraft);
      this.patch({
        sharedDraft,
        sharedDraftSerialized: serializeWorkflowDraft(sharedDraft),
        draftEditorContent: serializedDraft,
        draftParseError: undefined,
      });
      return;
    } catch (error) {
      this.patch({
        draftEditorContent: serializedDraft,
        draftParseError: error instanceof Error ? error.message : "Workflow draft is malformed.",
      });
    }
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
