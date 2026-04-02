import { useMemo, useState } from "react";
import type { CanonicalRecordValue } from "../../../domain/dataset-studio/CanonicalDataShapes";
import type { DatasetPipelineStageKind } from "../../../domain/dataset-studio/StagePipelineDomain";
import {
  DatasetStageWizardStateAdapter,
  type DatasetStageWizardSnapshot,
} from "../../studio-shell/dataset/DatasetStageWizardStateAdapter";
import DatasetStageWizardPanel from "./DatasetStageWizardPanel";
import DatasetStageCanvasReactFlow from "./DatasetStageCanvasReactFlow";

export interface DatasetStageAuthoringPanelProps {
  readonly templateId?: string;
  readonly mode?: "wizard" | "canvas";
  readonly showModeToggle?: boolean;
}

export default function DatasetStageAuthoringPanel(props: DatasetStageAuthoringPanelProps): JSX.Element {
  const adapter = useMemo(
    () => new DatasetStageWizardStateAdapter({ templateId: props.templateId }),
    [props.templateId],
  );

  const [localMode, setLocalMode] = useState<"wizard" | "canvas">(props.mode ?? "wizard");
  const mode = props.mode ?? localMode;
  const showModeToggle = props.showModeToggle ?? true;
  const [snapshot, setSnapshot] = useState<DatasetStageWizardSnapshot>(() => adapter.getSnapshot());
  const [selectedStageId, setSelectedStageId] = useState<string | undefined>(snapshot.currentStageId);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [configurationInput, setConfigurationInput] = useState<string>("{}");
  const [pipelineSnapshotJson, setPipelineSnapshotJson] = useState<string>("");
  const [selectedOptionalStageKind, setSelectedOptionalStageKind] = useState<DatasetPipelineStageKind | "">("");

  const graph = adapter.getCanvasGraph();
  const selectedGroup = selectedStageId
    ? graph.groups.find((group) => group.stageId === selectedStageId)
    : undefined;
  const addableStages = adapter.listAddableOptionalStages();

  const refresh = () => {
    const next = adapter.getSnapshot();
    setSnapshot(next);
    if (!selectedStageId || !next.stages.some((stage) => stage.id === selectedStageId)) {
      setSelectedStageId(next.currentStageId);
    }
  };

  const applyResult = (result: { readonly ok: boolean; readonly issues: ReadonlyArray<{ readonly message: string }> }) => {
    if (!result.ok) {
      setErrorMessage(result.issues[0]?.message ?? "Unable to apply stage edit.");
      return;
    }
    setErrorMessage(undefined);
    refresh();
  };

  return (
    <section className="ui-stack ui-stack--sm" data-testid="dataset-stage-authoring-panel">
      <header className="ui-row ui-row--between ui-row--wrap">
        <div className="ui-stack ui-stack--2xs">
          <h3>Dataset Stage Authoring</h3>
          <span className="ui-subtle">Wizard and Canvas share one stage-flow source of truth.</span>
        </div>
        {showModeToggle ? (
          <div className="ui-row ui-row--wrap">
            <button
              type="button"
              className={`ui-button ${mode === "wizard" ? "ui-button--primary" : "ui-button--ghost"}`}
              onClick={() => setLocalMode("wizard")}
              data-testid="dataset-stage-authoring-mode-wizard"
            >
              Wizard
            </button>
            <button
              type="button"
              className={`ui-button ${mode === "canvas" ? "ui-button--primary" : "ui-button--ghost"}`}
              onClick={() => setLocalMode("canvas")}
              data-testid="dataset-stage-authoring-mode-canvas"
            >
              Canvas
            </button>
          </div>
        ) : null}
      </header>

      {mode === "wizard" ? (
        <DatasetStageWizardPanel
          adapter={adapter}
          snapshot={snapshot}
          onSnapshotChange={(next) => {
            setSnapshot(next);
            if (!selectedStageId) {
              setSelectedStageId(next.currentStageId);
            }
          }}
        />
      ) : (
        <section className="ui-card ui-card--padded ui-stack ui-stack--sm">
          <header className="ui-row ui-row--between ui-row--wrap">
            <strong>Stage Canvas</strong>
            <div className="ui-row ui-row--wrap">
              <span className="ui-badge ui-badge--neutral">Stages: {graph.metadata.stageCount}</span>
              <span className="ui-badge ui-badge--neutral">Nodes: {graph.metadata.nodeCount}</span>
              <span className="ui-badge ui-badge--neutral">Edges: {graph.metadata.edgeCount}</span>
            </div>
          </header>

          <div className="ui-dataset-stage-canvas__layout">
            <DatasetStageCanvasReactFlow
              graph={graph}
              selectedStageId={selectedStageId}
              onSelectStage={(stageId) => {
                setSelectedStageId(stageId);
                const selected = snapshot.stages.find((stage) => stage.id === stageId);
                setConfigurationInput(JSON.stringify(selected?.configuration ?? {}, null, 2));
              }}
            />

            <aside className="ui-dataset-stage-canvas__inspector ui-stack ui-stack--xs" data-testid="dataset-stage-canvas-inspector">
              <strong>Stage Inspector</strong>
              {selectedGroup ? (
                <>
                  <div className="ui-stack ui-stack--3xs">
                    <span className="ui-text-small"><strong>{selectedGroup.title}</strong></span>
                    <span className="ui-subtle">{selectedGroup.description}</span>
                    <span className="ui-badge ui-badge--neutral">{selectedGroup.status}</span>
                  </div>

                  <div className="ui-meta-grid">
                    <div className="ui-meta-item">
                      <div className="ui-meta-label">Execution</div>
                      <div className="ui-meta-value">{selectedGroup.metadata.summary.executionMode}</div>
                    </div>
                    <div className="ui-meta-item">
                      <div className="ui-meta-label">Asset nodes</div>
                      <div className="ui-meta-value">{selectedGroup.metadata.summary.assetNodeCount}</div>
                    </div>
                    <div className="ui-meta-item">
                      <div className="ui-meta-label">Inspection status</div>
                      <div className="ui-meta-value">{selectedGroup.metadata.inspection?.status ?? "no-output"}</div>
                    </div>
                    <div className="ui-meta-item">
                      <div className="ui-meta-label">Preview</div>
                      <div className="ui-meta-value">{selectedGroup.metadata.inspection?.preview.availability ?? "unavailable"}</div>
                    </div>
                  </div>

                  {selectedGroup.metadata.inspection ? (
                    <section className="ui-card ui-card--padded ui-stack ui-stack--2xs">
                      <strong>{selectedGroup.metadata.inspection.summary.title}</strong>
                      <span className="ui-subtle">{selectedGroup.metadata.inspection.summary.detail}</span>
                    </section>
                  ) : null}

                  <label className="ui-field">
                    <span className="ui-field__label">Stage configuration (JSON)</span>
                    <textarea
                      className="ui-textarea ui-text-mono"
                      rows={8}
                      value={configurationInput}
                      onChange={(event) => setConfigurationInput(event.currentTarget.value)}
                    />
                  </label>

                  <div className="ui-row ui-row--wrap">
                    <button
                      type="button"
                      className="ui-button ui-button--primary ui-button--sm"
                      onClick={() => {
                        try {
                          const parsed = JSON.parse(configurationInput) as Readonly<Record<string, CanonicalRecordValue>>;
                          const result = adapter.updateStageConfiguration(selectedGroup.stageId, parsed);
                          applyResult(result);
                        } catch (error) {
                          setErrorMessage(error instanceof Error ? error.message : String(error));
                        }
                      }}
                    >
                      Apply config
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      onClick={() => {
                        const current = snapshot.stages.find((stage) => stage.id === selectedGroup.stageId);
                        setConfigurationInput(JSON.stringify(current?.configuration ?? {}, null, 2));
                      }}
                    >
                      Reset editor
                    </button>
                  </div>

                  <div className="ui-row ui-row--wrap">
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      onClick={() => {
                        const ordered = snapshot.stages.map((stage) => stage.id);
                        const index = ordered.findIndex((id) => id === selectedGroup.stageId);
                        if (index <= 0) {
                          return;
                        }
                        const next = [...ordered];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        applyResult(adapter.reorderStages(Object.freeze(next)));
                      }}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      onClick={() => {
                        const ordered = snapshot.stages.map((stage) => stage.id);
                        const index = ordered.findIndex((id) => id === selectedGroup.stageId);
                        if (index < 0 || index >= ordered.length - 1) {
                          return;
                        }
                        const next = [...ordered];
                        [next[index + 1], next[index]] = [next[index], next[index + 1]];
                        applyResult(adapter.reorderStages(Object.freeze(next)));
                      }}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      onClick={() => applyResult(adapter.removeOptionalStage(selectedGroup.stageId))}
                    >
                      Remove optional stage
                    </button>
                  </div>
                </>
              ) : (
                <span className="ui-subtle">Select a stage node to inspect and edit stage details.</span>
              )}

              <section className="ui-stack ui-stack--2xs">
                <strong>Add optional stage</strong>
                <label className="ui-field">
                  <span className="ui-field__label">Stage kind</span>
                  <select
                    className="ui-select"
                    value={selectedOptionalStageKind}
                    onChange={(event) => setSelectedOptionalStageKind(event.currentTarget.value as DatasetPipelineStageKind | "")}
                  >
                    <option value="">Select optional stage</option>
                    {addableStages.map((stage) => (
                      <option key={stage.stageKind} value={stage.stageKind}>{stage.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  disabled={!selectedOptionalStageKind}
                  onClick={() => {
                    if (!selectedOptionalStageKind) {
                      return;
                    }
                    applyResult(adapter.addOptionalStage(selectedOptionalStageKind));
                    setSelectedOptionalStageKind("");
                  }}
                >
                  Insert optional stage
                </button>
              </section>

              <section className="ui-stack ui-stack--2xs">
                <strong>Pipeline persistence snapshot</strong>
                <div className="ui-row ui-row--wrap">
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    onClick={() => {
                      setPipelineSnapshotJson(adapter.exportPersistedPipelineJson());
                      setErrorMessage(undefined);
                    }}
                  >
                    Save snapshot
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    disabled={!pipelineSnapshotJson.trim()}
                    onClick={() => {
                      try {
                        adapter.importPersistedPipeline(pipelineSnapshotJson);
                        setErrorMessage(undefined);
                        refresh();
                      } catch (error) {
                        setErrorMessage(error instanceof Error ? error.message : String(error));
                      }
                    }}
                  >
                    Reload snapshot
                  </button>
                </div>
                <label className="ui-field">
                  <span className="ui-field__label">Snapshot JSON</span>
                  <textarea
                    className="ui-textarea ui-text-mono"
                    rows={8}
                    value={pipelineSnapshotJson}
                    onChange={(event) => setPipelineSnapshotJson(event.currentTarget.value)}
                  />
                </label>
              </section>

              {errorMessage ? (
                <p className="ui-text-small ui-text-danger" data-testid="dataset-stage-canvas-error">{errorMessage}</p>
              ) : null}
            </aside>
          </div>

          <p className="ui-subtle" data-testid="dataset-stage-canvas-sync-note">
            Edits update the same underlying stage-flow state used by wizard navigation.
          </p>
        </section>
      )}
    </section>
  );
}
