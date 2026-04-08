import { useEffect, useMemo, useState } from "react";
import type {
  StudioImageWorkflowDefinitionReadModel,
  StudioImageWorkflowDefinitionSummaryReadModel,
} from "@infrastructure/api/studio-shell/StudioShellBackendApi";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";
import { StudioShellService } from "../../services/StudioShellService";
import SystemWorkflowParameterForm from "./SystemWorkflowParameterForm";
import {
  coerceWorkflowParameterInputValue,
  createWorkflowParameterInitialValues,
  validateWorkflowParameterValues,
} from "./SystemWorkflowParameterFormPresenter";

function readDefaultReferenceValues(content: string): {
  readonly workflowBindingId?: string;
  readonly workflowAssetId?: string;
  readonly workflowVersionId?: string;
  readonly datasetInstanceId?: string;
  readonly datasetAssetId?: string;
  readonly datasetVersionId?: string;
  readonly workflowParameterValuesByWorkflowId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
} {
  try {
    const parsed = JSON.parse(content) as {
      readonly systemSpec?: {
        readonly serialization?: {
          readonly runtime?: {
            readonly workflowBindings?: ReadonlyArray<{
              readonly bindingId: string;
              readonly workflowAssetId: string;
              readonly workflowVersionId?: string;
            }>;
            readonly datasetInstances?: ReadonlyArray<{
              readonly instanceId: string;
              readonly datasetAssetId?: string;
              readonly datasetVersionId?: string;
            }>;
            readonly state?: {
              readonly imageWorkflowParameterValuesByWorkflowId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
            };
          };
        };
      };
    };
    const firstWorkflowBinding = parsed.systemSpec?.serialization?.runtime?.workflowBindings?.[0];
    const firstDatasetBinding = parsed.systemSpec?.serialization?.runtime?.datasetInstances?.[0];
    return Object.freeze({
      workflowBindingId: firstWorkflowBinding?.bindingId,
      workflowAssetId: firstWorkflowBinding?.workflowAssetId,
      workflowVersionId: firstWorkflowBinding?.workflowVersionId,
      datasetInstanceId: firstDatasetBinding?.instanceId,
      datasetAssetId: firstDatasetBinding?.datasetAssetId,
      datasetVersionId: firstDatasetBinding?.datasetVersionId,
      workflowParameterValuesByWorkflowId: parsed.systemSpec?.serialization?.runtime?.state?.imageWorkflowParameterValuesByWorkflowId,
    });
  } catch {
    return Object.freeze({});
  }
}

export function SystemStudioWorkManagementPanel({ context }: { readonly context: StudioShellExtensionContext }): JSX.Element {
  const service = useMemo(() => new StudioShellService(), []);
  const draft = context.snapshot?.draft;
  const sessionId = context.snapshot?.activeSessionId;
  const defaults = useMemo(() => (draft ? readDefaultReferenceValues(draft.content) : Object.freeze({})), [draft?.content]);
  const [status, setStatus] = useState<string>();
  const [renameDraftTitle, setRenameDraftTitle] = useState(draft?.metadata.title ?? "");
  const [openDraftId, setOpenDraftId] = useState("");
  const [copyTitle, setCopyTitle] = useState("");
  const [workflowBindingId, setWorkflowBindingId] = useState(defaults.workflowBindingId ?? "");
  const [workflowAssetId, setWorkflowAssetId] = useState(defaults.workflowAssetId ?? "");
  const [workflowVersionId, setWorkflowVersionId] = useState(defaults.workflowVersionId ?? "");
  const [datasetInstanceId, setDatasetInstanceId] = useState(defaults.datasetInstanceId ?? "");
  const [datasetAssetId, setDatasetAssetId] = useState(defaults.datasetAssetId ?? "");
  const [datasetVersionId, setDatasetVersionId] = useState(defaults.datasetVersionId ?? "");
  const [supportedWorkflows, setSupportedWorkflows] = useState<ReadonlyArray<StudioImageWorkflowDefinitionSummaryReadModel>>([]);
  const [selectedWorkflowDetail, setSelectedWorkflowDetail] = useState<StudioImageWorkflowDefinitionReadModel>();
  const [workflowLoadError, setWorkflowLoadError] = useState<string>();
  const [isWorkflowListLoading, setIsWorkflowListLoading] = useState(false);
  const [workflowParameterValues, setWorkflowParameterValues] = useState<Readonly<Record<string, unknown>>>(Object.freeze({}));
  const [workflowParameterStatus, setWorkflowParameterStatus] = useState<string>();
  const workflowPickerAvailable = Boolean(context.operations.listImageWorkflowDefinitions && context.operations.getImageWorkflowDefinition);

  useEffect(() => {
    setWorkflowBindingId(defaults.workflowBindingId ?? "");
    setWorkflowAssetId(defaults.workflowAssetId ?? "");
    setWorkflowVersionId(defaults.workflowVersionId ?? "");
    setDatasetInstanceId(defaults.datasetInstanceId ?? "");
    setDatasetAssetId(defaults.datasetAssetId ?? "");
    setDatasetVersionId(defaults.datasetVersionId ?? "");
    setRenameDraftTitle(draft?.metadata.title ?? "");
    setWorkflowParameterStatus(undefined);
  }, [
    defaults.datasetAssetId,
    defaults.datasetInstanceId,
    defaults.datasetVersionId,
    defaults.workflowParameterValuesByWorkflowId,
    defaults.workflowAssetId,
    defaults.workflowBindingId,
    defaults.workflowVersionId,
    draft?.draftId,
    draft?.metadata.title,
  ]);

  useEffect(() => {
    const listImageWorkflowDefinitions = context.operations.listImageWorkflowDefinitions;
    if (!draft || !workflowPickerAvailable || !listImageWorkflowDefinitions) {
      setSupportedWorkflows([]);
      setSelectedWorkflowDetail(undefined);
      return;
    }

    let disposed = false;
    setIsWorkflowListLoading(true);
    setWorkflowLoadError(undefined);
    void listImageWorkflowDefinitions({})
      .then((response) => {
        if (disposed) {
          return;
        }
        if (!response?.ok || !response.data) {
          setWorkflowLoadError("Could not load supported workflows.");
          setSupportedWorkflows([]);
          return;
        }
        const items = response.data.items;
        setSupportedWorkflows(items);
        if (!workflowAssetId.trim()) {
          const preferredWorkflowId = defaults.workflowAssetId?.trim();
          const selectedFromList = preferredWorkflowId && items.some((entry) => entry.workflowId === preferredWorkflowId)
            ? preferredWorkflowId
            : items[0]?.workflowId;
          if (selectedFromList) {
            setWorkflowAssetId(selectedFromList);
          }
        }
      })
      .catch(() => {
        if (disposed) {
          return;
        }
        setWorkflowLoadError("Could not load supported workflows.");
        setSupportedWorkflows([]);
      })
      .finally(() => {
        if (!disposed) {
          setIsWorkflowListLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [defaults.workflowAssetId, draft?.draftId, workflowPickerAvailable]);

  useEffect(() => {
    const getImageWorkflowDefinition = context.operations.getImageWorkflowDefinition;
    if (!draft || !workflowAssetId.trim() || !workflowPickerAvailable || !getImageWorkflowDefinition) {
      setSelectedWorkflowDetail(undefined);
      return;
    }

    let disposed = false;
    void getImageWorkflowDefinition({
      workflowId: workflowAssetId.trim(),
    }).then((response) => {
      if (disposed) {
        return;
      }
      if (!response?.ok || !response.data) {
        setSelectedWorkflowDetail(undefined);
        return;
      }
      setSelectedWorkflowDetail(response.data);
      setWorkflowVersionId(response.data.version.versionTag);
      const savedValues = defaults.workflowParameterValuesByWorkflowId?.[response.data.workflowId];
      setWorkflowParameterValues(createWorkflowParameterInitialValues({
        workflow: response.data,
        existingValues: savedValues,
      }));
    }).catch(() => {
      if (!disposed) {
        setSelectedWorkflowDetail(undefined);
      }
    });

    return () => {
      disposed = true;
    };
  }, [defaults.workflowParameterValuesByWorkflowId, draft?.draftId, workflowAssetId, workflowPickerAvailable]);

  if (!draft || !sessionId) {
    return <p className="ui-text-small ui-text-secondary">Open a setup draft to save, reopen, copy, or rename.</p>;
  }

  const workflowParameterValidation = selectedWorkflowDetail
    ? validateWorkflowParameterValues({
      workflow: selectedWorkflowDetail,
      values: workflowParameterValues,
    })
    : undefined;

  return (
    <section className="ui-stack ui-stack--sm" data-testid="system-studio-work-management-panel">
      <p className="ui-text-small ui-text-secondary">Save your work, reopen a saved setup as an editable copy, make copies, and rename from one place.</p>
      <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
        <button
          type="button"
          className="ui-button ui-button--primary"
          onClick={() => {
            void service.saveSystemDefinition({
              studioId: context.studioId,
              sessionId,
              draftId: draft.draftId,
            }).then((response) => {
              if (!response.ok) {
                setStatus("Could not save right now. Please try again.");
                return;
              }
              setStatus("Saved.");
              void context.operations.refresh();
            });
          }}
        >
          Save work
        </button>
        <button
          type="button"
          className="ui-button"
          onClick={() => {
            if (!openDraftId.trim()) {
              setStatus("Choose a saved setup first.");
              return;
            }
            void service.duplicateSystemDefinition({
              studioId: context.studioId,
              sessionId,
              sourceDraftId: openDraftId.trim(),
              title: copyTitle.trim() || undefined,
            }).then((response) => {
              if (!response.ok) {
                setStatus("Could not open that setup. Please try again.");
                return;
              }
              setStatus("Opened as a safe editable copy.");
              void context.operations.refresh();
            });
          }}
        >
          Open saved setup
        </button>
        <button
          type="button"
          className="ui-button"
          onClick={() => {
            void service.duplicateSystemDefinition({
              studioId: context.studioId,
              sessionId,
              sourceDraftId: draft.draftId,
              title: copyTitle.trim() || `${draft.metadata.title} copy`,
            }).then((response) => {
              if (!response.ok) {
                setStatus("Could not make a copy. Please try again.");
                return;
              }
              setStatus("Copy created.");
              void context.operations.refresh();
            });
          }}
        >
          Make a copy
        </button>
      </div>

      <label className="ui-field">
        <span className="ui-field__label">Rename this work</span>
        <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
          <input
            className="ui-input"
            value={renameDraftTitle}
            onChange={(event) => setRenameDraftTitle(event.currentTarget.value)}
            placeholder="My image setup"
          />
          <button
            type="button"
            className="ui-button"
            onClick={() => {
              if (!renameDraftTitle.trim()) {
                setStatus("Name cannot be empty.");
                return;
              }
              void service.updateDraft({
                studioId: context.studioId,
                sessionId,
                draftId: draft.draftId,
                metadataPatch: { title: renameDraftTitle.trim() },
              }).then((response) => {
                if (!response.ok) {
                  setStatus("Could not rename right now.");
                  return;
                }
                setStatus("Name updated.");
                void context.operations.refresh();
              });
            }}
          >
            Rename
          </button>
        </div>
      </label>

      <div className="ui-stack ui-stack--xs" data-testid="system-studio-workflow-picker">
        <strong>Supported workflow operations</strong>
        <label className="ui-field">
          <span className="ui-field__label">Choose operation</span>
          <select
            className="ui-select"
            value={workflowAssetId}
            onChange={(event) => setWorkflowAssetId(event.currentTarget.value)}
            disabled={!workflowPickerAvailable || isWorkflowListLoading}
          >
            <option value="">Select a supported workflow</option>
            {supportedWorkflows.map((workflow) => (
              <option key={workflow.workflowId} value={workflow.workflowId}>
                {workflow.title} ({workflow.operationKind})
              </option>
            ))}
          </select>
        </label>
        {isWorkflowListLoading ? (
          <span className="ui-text-small ui-text-secondary">Loading supported workflows...</span>
        ) : null}
        {!workflowPickerAvailable ? (
          <span className="ui-text-small ui-text-secondary">Workflow selection is unavailable in this host.</span>
        ) : null}
        {workflowLoadError ? (
          <span className="ui-text-small ui-text-danger">{workflowLoadError}</span>
        ) : null}
        {selectedWorkflowDetail ? (
          <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
            <strong>{selectedWorkflowDetail.title}</strong>
            <p className="ui-text-small ui-text-secondary">{selectedWorkflowDetail.summary}</p>
            <p className="ui-text-small ui-text-secondary">{selectedWorkflowDetail.rationale}</p>
            <p className="ui-text-small ui-text-secondary">
              ID: {selectedWorkflowDetail.workflowId}
              {" | "}
              Version: {selectedWorkflowDetail.version.versionTag}
            </p>
          </div>
        ) : null}
        {selectedWorkflowDetail && workflowParameterValidation ? (
          <SystemWorkflowParameterForm
            workflow={selectedWorkflowDetail}
            values={workflowParameterValues}
            validation={workflowParameterValidation}
            busy={context.isBusy}
            onValueChanged={(parameterId, nextValue) => {
              const specification = selectedWorkflowDetail.parameterSpecifications.find(
                (entry) => entry.parameterId === parameterId,
              );
              if (!specification) {
                return;
              }
              const typedValue = typeof nextValue === "boolean"
                ? nextValue
                : coerceWorkflowParameterInputValue(specification, String(nextValue));
              setWorkflowParameterValues((current) => Object.freeze({
                ...current,
                [parameterId]: typedValue,
              }));
            }}
            onSaveRequested={() => {
              if (workflowParameterValidation.hasIssues) {
                setWorkflowParameterStatus("Some settings still need attention before saving.");
                return;
              }
              const currentSavedByWorkflow = defaults.workflowParameterValuesByWorkflowId ?? {};
              void service.modifySystemDefinition({
                studioId: context.studioId,
                sessionId,
                draftId: draft.draftId,
                runtimeStatePatch: {
                  imageWorkflowParameterValuesByWorkflowId: {
                    ...currentSavedByWorkflow,
                    [selectedWorkflowDetail.workflowId]: workflowParameterValues,
                  },
                },
              }).then((response) => {
                if (!response.ok) {
                  setWorkflowParameterStatus("Could not save operation settings.");
                  return;
                }
                setWorkflowParameterStatus("Operation settings saved.");
                void context.operations.refresh();
              });
            }}
          />
        ) : null}
        {workflowParameterStatus ? (
          <span className="ui-text-small ui-text-secondary">{workflowParameterStatus}</span>
        ) : null}
      </div>

      <details>
        <summary className="ui-text-small ui-text-secondary">Advanced setup changes</summary>
        <div className="ui-stack ui-stack--xs" style={{ marginTop: "0.5rem" }}>
          <div className="ui-form-grid">
            <label className="ui-field">
              <span className="ui-field__label">Processing binding</span>
              <input className="ui-input" value={workflowBindingId} onChange={(event) => setWorkflowBindingId(event.currentTarget.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Selected workflow id</span>
              <input className="ui-input" value={workflowAssetId} readOnly />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Workflow version</span>
              <input className="ui-input" value={workflowVersionId} onChange={(event) => setWorkflowVersionId(event.currentTarget.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Image collection slot</span>
              <input className="ui-input" value={datasetInstanceId} onChange={(event) => setDatasetInstanceId(event.currentTarget.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Image collection</span>
              <input className="ui-input" value={datasetAssetId} onChange={(event) => setDatasetAssetId(event.currentTarget.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Collection version</span>
              <input className="ui-input" value={datasetVersionId} onChange={(event) => setDatasetVersionId(event.currentTarget.value)} />
            </label>
          </div>
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={() => {
              void service.modifySystemDefinition({
                studioId: context.studioId,
                sessionId,
                draftId: draft.draftId,
                workflowBindings: workflowBindingId.trim() && workflowAssetId.trim()
                  ? [{
                    bindingId: workflowBindingId.trim(),
                    workflowAssetId: workflowAssetId.trim(),
                    workflowVersionId: workflowVersionId.trim() || undefined,
                  }]
                  : undefined,
                datasetBindings: datasetInstanceId.trim() && datasetAssetId.trim()
                  ? [{
                    instanceId: datasetInstanceId.trim(),
                    datasetAssetId: datasetAssetId.trim(),
                    datasetVersionId: datasetVersionId.trim() || undefined,
                  }]
                  : undefined,
              }).then((response) => {
                if (!response.ok) {
                  setStatus("Could not apply advanced setup changes.");
                  return;
                }
                setStatus("Advanced setup updated.");
                void context.operations.refresh();
              });
            }}
          >
            Apply setup changes
          </button>
          <label className="ui-field">
            <span className="ui-field__label">Open this saved draft id</span>
            <input className="ui-input" value={openDraftId} onChange={(event) => setOpenDraftId(event.currentTarget.value)} placeholder="draft-123" />
          </label>
          <label className="ui-field">
            <span className="ui-field__label">Copy name (optional)</span>
            <input className="ui-input" value={copyTitle} onChange={(event) => setCopyTitle(event.currentTarget.value)} placeholder="My image setup copy" />
          </label>
          <p className="ui-text-small ui-text-secondary">Current draft id: {draft.draftId}</p>
        </div>
      </details>

      {status ? <p className="ui-text-small ui-text-secondary">{status}</p> : null}
    </section>
  );
}
