import { useMemo, useState } from "react";
import type { CanonicalRecordValue } from "../../../domain/dataset-studio/CanonicalDataShapes";
import {
  DatasetStageWizardStateAdapter,
  type DatasetStageWizardSnapshot,
  type DatasetStageWizardStageViewModel,
} from "../../studio-shell/dataset/DatasetStageWizardStateAdapter";
import StageWizardProgressNavigator from "../wizard/StageWizardProgressNavigator";

export interface DatasetStageWizardPanelProps {
  readonly templateId?: string;
  readonly adapter?: DatasetStageWizardStateAdapter;
  readonly snapshot?: DatasetStageWizardSnapshot;
  readonly onSnapshotChange?: (snapshot: DatasetStageWizardSnapshot) => void;
}

function renderStageConfigurationSummary(configuration: Readonly<Record<string, CanonicalRecordValue>>): JSX.Element {
  const entries = Object.entries(configuration);
  if (entries.length === 0) {
    return <span className="ui-subtle">No configuration set yet.</span>;
  }
  return (
    <ul className="ui-stack ui-stack--2xs">
      {entries.map(([key, value]) => (
        <li key={key}>
          <strong>{key}</strong>: <span className="ui-text-mono">{JSON.stringify(value)}</span>
        </li>
      ))}
    </ul>
  );
}

function StageFallbackRenderer(props: { readonly stage: DatasetStageWizardStageViewModel }): JSX.Element {
  return (
    <section className="ui-stack ui-stack--xs" data-testid="dataset-stage-fallback-renderer">
      <strong>Stage summary</strong>
      <span className="ui-subtle">{props.stage.description}</span>
      <div className="ui-meta-grid">
        <div className="ui-meta-item">
          <div className="ui-meta-label">Category</div>
          <div className="ui-meta-value">{props.stage.metadata.stageCategory}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Inputs</div>
          <div className="ui-meta-value">{props.stage.metadata.acceptedInputShapeKinds.join(", ")}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Outputs</div>
          <div className="ui-meta-value">{props.stage.metadata.producedOutputShapeKinds.join(", ")}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Assets</div>
          <div className="ui-meta-value">{props.stage.metadata.assetReferences.map((asset) => asset.assetId).join(", ")}</div>
        </div>
      </div>
      {renderStageConfigurationSummary(props.stage.configuration)}
    </section>
  );
}

function StageInspectionSummary(props: { readonly stage: DatasetStageWizardStageViewModel }): JSX.Element {
  const inspection = props.stage.inspection;
  return (
    <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid={`dataset-stage-inspection-${props.stage.id}`}>
      <strong>{inspection.summary.title}</strong>
      <span className="ui-subtle">{inspection.summary.detail}</span>
      <div className="ui-meta-grid">
        <div className="ui-meta-item">
          <div className="ui-meta-label">Inspection status</div>
          <div className="ui-meta-value">{inspection.status}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Contract</div>
          <div className="ui-meta-value">{inspection.contract.kind}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Preview</div>
          <div className="ui-meta-value">{inspection.preview.availability}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Preview reference</div>
          <div className="ui-meta-value">{inspection.preview.reference ?? "-"}</div>
        </div>
      </div>
      {inspection.summary.fields.length > 0 ? (
        <ul className="ui-stack ui-stack--3xs">
          {inspection.summary.fields.map((field) => (
            <li key={`${props.stage.id}:${field.label}`}>
              <strong>{field.label}</strong>: <span className="ui-text-mono">{field.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {inspection.preview.availability === "unavailable" ? (
        <span className="ui-subtle">{inspection.preview.fallbackSummary ?? "No preview available."}</span>
      ) : null}
      <span className="ui-subtle">
        Upstream: {inspection.upstreamMetadata.upstreamStageIds.join(", ") || "-"} | Pipeline: {inspection.upstreamMetadata.pipelineId ?? "-"}
      </span>
    </section>
  );
}

function StageSourceRenderer(props: {
  readonly stage: DatasetStageWizardStageViewModel;
  readonly onApply: (configuration: Readonly<Record<string, CanonicalRecordValue>>) => void;
}): JSX.Element {
  const sourceKind = typeof props.stage.configuration.sourceKind === "string" ? props.stage.configuration.sourceKind : "auto";
  const sourceReference = typeof props.stage.configuration.sourceReference === "string" ? props.stage.configuration.sourceReference : "";
  return (
    <section className="ui-stack ui-stack--xs">
      <strong>Source configuration</strong>
      <label className="ui-field">
        <span className="ui-field__label">Source kind</span>
        <select
          className="ui-select"
          defaultValue={sourceKind}
          onChange={(event) => props.onApply({
            ...props.stage.configuration,
            sourceKind: event.currentTarget.value,
          })}
        >
          <option value="auto">auto</option>
          <option value="csv">csv</option>
          <option value="json">json</option>
          <option value="document">document</option>
          <option value="image">image</option>
        </select>
      </label>
      <label className="ui-field">
        <span className="ui-field__label">Source reference</span>
        <input
          className="ui-input"
          type="text"
          defaultValue={sourceReference}
          placeholder="in-memory://source or C:\\data\\source.csv"
          onBlur={(event) => props.onApply({
            ...props.stage.configuration,
            sourceReference: event.currentTarget.value,
          })}
        />
      </label>
    </section>
  );
}

function StageIngestionRenderer(props: {
  readonly stage: DatasetStageWizardStageViewModel;
  readonly onApply: (configuration: Readonly<Record<string, CanonicalRecordValue>>) => void;
}): JSX.Element {
  const outputTarget = typeof props.stage.configuration.outputTarget === "string" ? props.stage.configuration.outputTarget : "records";
  return (
    <section className="ui-stack ui-stack--xs">
      <strong>Ingestion configuration</strong>
      <label className="ui-field">
        <span className="ui-field__label">Output target</span>
        <select
          className="ui-select"
          defaultValue={outputTarget}
          onChange={(event) => props.onApply({
            ...props.stage.configuration,
            outputTarget: event.currentTarget.value,
          })}
        >
          <option value="records">records</option>
          <option value="text-items">text-items</option>
          <option value="image-metadata-records">image-metadata-records</option>
        </select>
      </label>
      <span className="ui-subtle">Advanced editors for route overrides and schema mapping can plug into this stage later.</span>
    </section>
  );
}

export default function DatasetStageWizardPanel(props: DatasetStageWizardPanelProps): JSX.Element {
  const localAdapter = useMemo(
    () => new DatasetStageWizardStateAdapter({ templateId: props.templateId }),
    [props.templateId],
  );
  const adapter = props.adapter ?? localAdapter;
  const [localSnapshot, setLocalSnapshot] = useState<DatasetStageWizardSnapshot>(() => adapter.getSnapshot());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editError, setEditError] = useState<string | undefined>(undefined);

  const snapshot = props.snapshot ?? localSnapshot;
  const currentStage = snapshot.currentStage;
  const priorInspectableStages = snapshot.stages.filter((stage) => (
    stage.id !== currentStage?.id
    && (stage.status === "completed" || stage.status === "skipped")
  ));

  const updateSnapshot = () => {
    const next = adapter.getSnapshot();
    setLocalSnapshot(next);
    props.onSnapshotChange?.(next);
  };
  const applyConfiguration = (configuration: Readonly<Record<string, CanonicalRecordValue>>) => {
    if (!currentStage) {
      return;
    }
    const result = adapter.updateStageConfiguration(currentStage.id, configuration);
    if (!result.ok) {
      setEditError(result.issues[0]?.message ?? "Unable to apply stage configuration.");
      return;
    }
    setEditError(undefined);
    updateSnapshot();
  };

  return (
    <section className="ui-card ui-card--padded ui-stage-wizard ui-stack ui-stack--md" data-testid="dataset-stage-wizard-panel">
      <header className="ui-stack ui-stack--2xs">
        <h3>Dataset Stage Wizard</h3>
        <span className="ui-subtle">Stage {currentStage?.order ?? 1} of {snapshot.stages.length}</span>
        <span className="ui-subtle">{snapshot.progressPercent}% completed</span>
      </header>

      <div className="ui-stage-wizard__layout">
        <StageWizardProgressNavigator
          title="Dataset stage wizard"
          steps={snapshot.stages.map((stage) => ({
            id: stage.id,
            name: stage.name,
            description: stage.description,
            order: stage.order,
            status: stage.status,
            isDisabled: stage.isDisabled,
          }))}
        />

        <section className="ui-stage-wizard__panel ui-stack ui-stack--sm">
          {currentStage ? (
            <>
              <header className="ui-stack ui-stack--2xs">
                <h4>{currentStage.name}</h4>
                <span className="ui-subtle">{currentStage.description}</span>
              </header>

              {currentStage.kind === "source" || currentStage.kind === "source-selection" ? (
                <StageSourceRenderer stage={currentStage} onApply={applyConfiguration} />
              ) : null}

              {currentStage.kind === "ingestion" ? (
                <StageIngestionRenderer stage={currentStage} onApply={applyConfiguration} />
              ) : null}

              {currentStage.kind !== "source" && currentStage.kind !== "source-selection" && currentStage.kind !== "ingestion" ? (
                <StageFallbackRenderer stage={currentStage} />
              ) : null}

              <StageInspectionSummary stage={currentStage} />
            </>
          ) : (
            <span className="ui-subtle">No active stage.</span>
          )}

          {priorInspectableStages.length > 0 ? (
            <section className="ui-stack ui-stack--2xs">
              <strong>Completed stage outputs</strong>
              {priorInspectableStages.map((stage) => (
                <StageInspectionSummary key={`prior-${stage.id}`} stage={stage} />
              ))}
            </section>
          ) : null}

          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={() => setShowAdvanced((current) => !current)}
          >
            {showAdvanced ? "Hide advanced details" : "Show advanced details"}
          </button>

          {showAdvanced && currentStage ? (
            <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="dataset-stage-wizard-advanced">
              <strong>Advanced metadata</strong>
              <div className="ui-meta-grid">
                <div className="ui-meta-item">
                  <div className="ui-meta-label">Execution mode</div>
                  <div className="ui-meta-value">{currentStage.executionMode}</div>
                </div>
                <div className="ui-meta-item">
                  <div className="ui-meta-label">Status marker</div>
                  <div className="ui-meta-value">{currentStage.metadata.statusMarker}</div>
                </div>
                <div className="ui-meta-item">
                  <div className="ui-meta-label">Pipeline lineage</div>
                  <div className="ui-meta-value">{currentStage.metadata.pipelineId ?? "-"}</div>
                </div>
                <div className="ui-meta-item">
                  <div className="ui-meta-label">Lineage id</div>
                  <div className="ui-meta-value">{currentStage.metadata.lineageId ?? "-"}</div>
                </div>
              </div>
            </section>
          ) : null}

          {editError ? (
            <p className="ui-text-small ui-text-danger" data-testid="dataset-stage-wizard-edit-error">{editError}</p>
          ) : null}

          <footer className="ui-row ui-row--between ui-row--wrap">
            <button
              type="button"
              className="ui-button ui-button--ghost"
              onClick={() => {
                adapter.goBack();
                setEditError(undefined);
                updateSnapshot();
              }}
              disabled={!snapshot.canGoBack}
            >
              Back
            </button>
            <button
              type="button"
              className="ui-button ui-button--primary"
              onClick={() => {
                adapter.goNext();
                setEditError(undefined);
                updateSnapshot();
              }}
              disabled={!snapshot.canGoNext}
            >
              Next
            </button>
          </footer>
        </section>
      </div>
    </section>
  );
}
