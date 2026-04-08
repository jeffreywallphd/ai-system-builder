import { useEffect, useMemo, useState } from "react";
import type {
  StudioImageSystemDefinitionReadModel,
  StudioImageSystemDefinitionSummaryReadModel,
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
import {
  presentSavedImageSystemOptions,
  presentSupportedEditTypeOptions,
} from "./SystemWorkflowSelectionPresenter";

function readDefaultReferenceValues(content: string): {
  readonly imageSystemDefinitionId?: string;
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
              readonly imageSystemDefinitionId?: string;
              readonly imageWorkflowParameterValuesByWorkflowId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
            };
          };
        };
      };
    };
    const firstWorkflowBinding = parsed.systemSpec?.serialization?.runtime?.workflowBindings?.[0];
    const firstDatasetBinding = parsed.systemSpec?.serialization?.runtime?.datasetInstances?.[0];
    return Object.freeze({
      imageSystemDefinitionId: parsed.systemSpec?.serialization?.runtime?.state?.imageSystemDefinitionId,
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
  const [savedSystems, setSavedSystems] = useState<ReadonlyArray<StudioImageSystemDefinitionSummaryReadModel>>([]);
  const [selectedSavedSystemId, setSelectedSavedSystemId] = useState(defaults.imageSystemDefinitionId ?? "");
  const [selectedSavedSystemDetail, setSelectedSavedSystemDetail] = useState<StudioImageSystemDefinitionReadModel>();
  const [systemLoadError, setSystemLoadError] = useState<string>();
  const [isSystemListLoading, setIsSystemListLoading] = useState(false);
  const [isSystemDetailLoading, setIsSystemDetailLoading] = useState(false);
  const workflowPickerAvailable = Boolean(context.operations.listImageWorkflowDefinitions && context.operations.getImageWorkflowDefinition);
  const imageSystemOperationsAvailable = Boolean(
    context.operations.listImageSystemDefinitions
    && context.operations.getImageSystemDefinition
    && context.operations.saveImageSystemDefinition,
  );

  useEffect(() => {
    setWorkflowBindingId(defaults.workflowBindingId ?? "");
    setWorkflowAssetId(defaults.workflowAssetId ?? "");
    setWorkflowVersionId(defaults.workflowVersionId ?? "");
    setDatasetInstanceId(defaults.datasetInstanceId ?? "");
    setDatasetAssetId(defaults.datasetAssetId ?? "");
    setDatasetVersionId(defaults.datasetVersionId ?? "");
    setSelectedSavedSystemId(defaults.imageSystemDefinitionId ?? "");
    setRenameDraftTitle(draft?.metadata.title ?? "");
    setWorkflowParameterStatus(undefined);
  }, [
    defaults.imageSystemDefinitionId,
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
          setWorkflowLoadError("Could not load supported edit types.");
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
        setWorkflowLoadError("Could not load supported edit types.");
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

  useEffect(() => {
    const listImageSystemDefinitions = context.operations.listImageSystemDefinitions;
    if (!draft || !imageSystemOperationsAvailable || !listImageSystemDefinitions) {
      setSavedSystems([]);
      setSelectedSavedSystemDetail(undefined);
      return;
    }

    let disposed = false;
    setIsSystemListLoading(true);
    setSystemLoadError(undefined);
    void listImageSystemDefinitions({
      limit: 50,
    }).then((response) => {
      if (disposed) {
        return;
      }
      if (!response?.ok || !response.data) {
        setSystemLoadError("Could not load saved image systems.");
        setSavedSystems([]);
        return;
      }
      setSavedSystems(response.data.items);
      if (!selectedSavedSystemId.trim()) {
        const preferredSystemId = defaults.imageSystemDefinitionId?.trim();
        const selectedFromList = preferredSystemId && response.data.items.some((entry) => entry.systemId === preferredSystemId)
          ? preferredSystemId
          : response.data.items[0]?.systemId;
        if (selectedFromList) {
          setSelectedSavedSystemId(selectedFromList);
        }
      }
    }).catch(() => {
      if (!disposed) {
        setSystemLoadError("Could not load saved image systems.");
        setSavedSystems([]);
      }
    }).finally(() => {
      if (!disposed) {
        setIsSystemListLoading(false);
      }
    });

    return () => {
      disposed = true;
    };
  }, [
    defaults.imageSystemDefinitionId,
    draft?.draftId,
    imageSystemOperationsAvailable,
    selectedSavedSystemId,
  ]);

  useEffect(() => {
    const getImageSystemDefinition = context.operations.getImageSystemDefinition;
    if (!draft || !selectedSavedSystemId.trim() || !imageSystemOperationsAvailable || !getImageSystemDefinition) {
      setSelectedSavedSystemDetail(undefined);
      return;
    }

    let disposed = false;
    setIsSystemDetailLoading(true);
    void getImageSystemDefinition({
      systemId: selectedSavedSystemId.trim(),
    }).then((response) => {
      if (disposed) {
        return;
      }
      if (!response?.ok || !response.data) {
        setSelectedSavedSystemDetail(undefined);
        return;
      }
      setSelectedSavedSystemDetail(response.data);
    }).catch(() => {
      if (!disposed) {
        setSelectedSavedSystemDetail(undefined);
      }
    }).finally(() => {
      if (!disposed) {
        setIsSystemDetailLoading(false);
      }
    });

    return () => {
      disposed = true;
    };
  }, [draft?.draftId, imageSystemOperationsAvailable, selectedSavedSystemId]);

  if (!draft || !sessionId) {
    return <p className="ui-text-small ui-text-secondary">Open a setup draft to save, reopen, update, or rename.</p>;
  }

  const workflowParameterValidation = selectedWorkflowDetail
    ? validateWorkflowParameterValues({
      workflow: selectedWorkflowDetail,
      values: workflowParameterValues,
    })
    : undefined;
  const editTypeOptions = presentSupportedEditTypeOptions({
    workflows: supportedWorkflows,
    selectedWorkflowId: workflowAssetId,
  });
  const selectedEditTypeOption = editTypeOptions.find((entry) => entry.selected);
  const savedSystemOptions = presentSavedImageSystemOptions({
    systems: savedSystems,
    workflows: supportedWorkflows,
    selectedSystemId: selectedSavedSystemId,
  });

  return (
    <section className="ui-stack ui-stack--sm" data-testid="system-studio-work-management-panel">
      <p className="ui-text-small ui-text-secondary">
        Save reusable image systems, reopen prior work, choose an edit type, and keep setup details in sync from authoritative definitions.
      </p>
      <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
        <button
          type="button"
          className="ui-button ui-button--primary"
          onClick={() => {
            if (!selectedWorkflowDetail) {
              setStatus("Choose a supported edit type before saving.");
              return;
            }
            if (workflowParameterValidation?.hasIssues) {
              setStatus("Resolve operation setting issues before saving as new.");
              return;
            }
            const nextWorkflowValues = {
              ...(defaults.workflowParameterValuesByWorkflowId ?? {}),
              [selectedWorkflowDetail.workflowId]: workflowParameterValues,
            };
            void service.modifySystemDefinition({
              studioId: context.studioId,
              sessionId,
              draftId: draft.draftId,
              workflowBindings: [{
                bindingId: workflowBindingId.trim() || "component:primary",
                workflowAssetId: selectedWorkflowDetail.workflowId,
                workflowVersionId: workflowVersionId.trim() || selectedWorkflowDetail.version.versionTag,
              }],
              runtimeStatePatch: {
                imageWorkflowParameterValuesByWorkflowId: nextWorkflowValues,
              },
            }).then((modifyResponse) => {
              if (!modifyResponse.ok) {
                setStatus("Could not prepare this draft for save.");
                return;
              }
              if (!context.operations.saveImageSystemDefinition) {
                setStatus("Image system save is unavailable in this host.");
                return;
              }
              void context.operations.saveImageSystemDefinition({
                studioId: context.studioId,
                sessionId,
                draftId: draft.draftId,
                saveAsNew: true,
                title: renameDraftTitle.trim() || draft.metadata.title,
              }).then((saveResponse) => {
                if (!saveResponse.ok || !saveResponse.data) {
                  setStatus("Could not save as a new image system.");
                  return;
                }
                setSelectedSavedSystemId(saveResponse.data.systemId);
                setStatus("Saved as new image system.");
                void context.operations.refresh();
              });
            });
          }}
        >
          Save as new
        </button>
        <button
          type="button"
          className="ui-button"
          onClick={() => {
            if (!selectedSavedSystemId.trim()) {
              setStatus("Choose a saved image system first.");
              return;
            }
            if (!context.operations.getImageSystemDefinition) {
              setStatus("Image system reopen is unavailable in this host.");
              return;
            }
            setStatus("Reopening saved image system...");
            void context.operations.getImageSystemDefinition({
              systemId: selectedSavedSystemId.trim(),
            }).then((response) => {
              if (!response.ok || !response.data) {
                setStatus("Could not reopen that image system.");
                return;
              }
              const reopened = response.data;
              setWorkflowAssetId(reopened.workflowId);
              setWorkflowVersionId(reopened.workflowVersionTag);
              setWorkflowParameterValues(reopened.parameterBaseline);
              setSelectedSavedSystemId(reopened.systemId);

              const nextWorkflowValues = {
                ...(defaults.workflowParameterValuesByWorkflowId ?? {}),
                [reopened.workflowId]: reopened.parameterBaseline,
              };
              void service.modifySystemDefinition({
                studioId: context.studioId,
                sessionId,
                draftId: draft.draftId,
                workflowBindings: [{
                  bindingId: workflowBindingId.trim() || "component:primary",
                  workflowAssetId: reopened.workflowId,
                  workflowVersionId: reopened.workflowVersionTag,
                }],
                runtimeStatePatch: {
                  imageSystemDefinitionId: reopened.systemId,
                  imageWorkflowParameterValuesByWorkflowId: nextWorkflowValues,
                },
              }).then((modifyResponse) => {
                if (!modifyResponse.ok) {
                  setStatus("Reopened system, but could not fully apply state to this draft.");
                  return;
                }
                setStatus(`Reopened '${reopened.title}' (${reopened.readinessSummary}).`);
                void context.operations.refresh();
              });
            });
          }}
        >
          Reopen saved
        </button>
        <button
          type="button"
          className="ui-button"
          onClick={() => {
            if (!selectedSavedSystemId.trim()) {
              setStatus("Choose a saved image system to update.");
              return;
            }
            if (!selectedWorkflowDetail) {
              setStatus("Choose a supported edit type before updating.");
              return;
            }
            if (workflowParameterValidation?.hasIssues) {
              setStatus("Resolve operation setting issues before updating.");
              return;
            }
            const nextWorkflowValues = {
              ...(defaults.workflowParameterValuesByWorkflowId ?? {}),
              [selectedWorkflowDetail.workflowId]: workflowParameterValues,
            };
            void service.modifySystemDefinition({
              studioId: context.studioId,
              sessionId,
              draftId: draft.draftId,
              workflowBindings: [{
                bindingId: workflowBindingId.trim() || "component:primary",
                workflowAssetId: selectedWorkflowDetail.workflowId,
                workflowVersionId: workflowVersionId.trim() || selectedWorkflowDetail.version.versionTag,
              }],
              runtimeStatePatch: {
                imageSystemDefinitionId: selectedSavedSystemId.trim(),
                imageWorkflowParameterValuesByWorkflowId: nextWorkflowValues,
              },
            }).then((modifyResponse) => {
              if (!modifyResponse.ok) {
                setStatus("Could not prepare this draft for update.");
                return;
              }
              if (!context.operations.saveImageSystemDefinition) {
                setStatus("Image system update is unavailable in this host.");
                return;
              }
              void context.operations.saveImageSystemDefinition({
                studioId: context.studioId,
                sessionId,
                draftId: draft.draftId,
                existingSystemId: selectedSavedSystemId.trim(),
                saveAsNew: false,
                title: renameDraftTitle.trim() || draft.metadata.title,
              }).then((updateResponse) => {
                if (!updateResponse.ok || !updateResponse.data) {
                  setStatus("Could not update that image system.");
                  return;
                }
                setSelectedSavedSystemId(updateResponse.data.systemId);
                setStatus("Updated saved image system.");
                void context.operations.refresh();
              });
            });
          }}
        >
          Update saved
        </button>
      </div>

      <div className="ui-stack ui-stack--xs" data-testid="system-studio-saved-systems">
        <strong>Saved image systems</strong>
        <label className="ui-field">
          <span className="ui-field__label">Reopen saved work</span>
          <select
            className="ui-select"
            value={selectedSavedSystemId}
            onChange={(event) => setSelectedSavedSystemId(event.currentTarget.value)}
            disabled={!imageSystemOperationsAvailable || isSystemListLoading}
          >
            <option value="">Select a saved image system</option>
            {savedSystemOptions.map((system) => (
              <option key={system.systemId} value={system.systemId}>
                {system.title}
                {system.editTypeTitle ? ` - ${system.editTypeTitle}` : ""}
              </option>
            ))}
          </select>
        </label>
        {isSystemListLoading ? (
          <span className="ui-text-small ui-text-secondary">Loading saved image systems...</span>
        ) : null}
        {systemLoadError ? (
          <span className="ui-text-small ui-text-danger">{systemLoadError}</span>
        ) : null}
        {isSystemDetailLoading ? (
          <span className="ui-text-small ui-text-secondary">Loading selected system details...</span>
        ) : null}
        {selectedSavedSystemDetail ? (
          <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
            <strong>{selectedSavedSystemDetail.title}</strong>
            <p className="ui-text-small ui-text-secondary">
              Readiness: {selectedSavedSystemDetail.readinessSummary}
            </p>
            <details>
              <summary className="ui-text-small ui-text-secondary">Advanced system metadata</summary>
              <p className="ui-text-small ui-text-secondary" style={{ marginTop: "0.5rem" }}>
                Workflow ID: {selectedSavedSystemDetail.workflowId}
                {" | "}
                Workflow version: {selectedSavedSystemDetail.workflowVersionTag}
              </p>
            </details>
          </div>
        ) : null}
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
        <strong>Supported edit types</strong>
        <label className="ui-field">
          <span className="ui-field__label">Choose edit type</span>
          <select
            className="ui-select"
            value={workflowAssetId}
            onChange={(event) => setWorkflowAssetId(event.currentTarget.value)}
            disabled={!workflowPickerAvailable || isWorkflowListLoading}
          >
            <option value="">Select a supported edit type</option>
            {editTypeOptions.map((workflow) => (
              <option key={workflow.workflowId} value={workflow.workflowId}>
                {workflow.title}
              </option>
            ))}
          </select>
        </label>
        {selectedEditTypeOption?.recommended ? (
          <span className="ui-text-small ui-text-secondary">Recommended default edit type is selected for this draft.</span>
        ) : editTypeOptions[0] ? (
          <span className="ui-text-small ui-text-secondary">
            Recommended: {editTypeOptions[0].title}
          </span>
        ) : null}
        {editTypeOptions.length > 0 ? (
          <div className="ui-grid ui-grid--2">
            {editTypeOptions.map((option) => (
              <button
                key={option.workflowId}
                type="button"
                className="ui-button ui-button--ghost"
                onClick={() => setWorkflowAssetId(option.workflowId)}
                aria-pressed={option.selected}
              >
                <span>{option.title}{option.selected ? " (Selected)" : ""}</span>
                <span className="ui-text-small ui-text-secondary">{option.summary}</span>
                {option.recommended ? (
                  <span className="ui-text-small ui-text-secondary">Recommended</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        {isWorkflowListLoading ? (
          <span className="ui-text-small ui-text-secondary">Loading supported edit types...</span>
        ) : null}
        {!workflowPickerAvailable ? (
          <span className="ui-text-small ui-text-secondary">Edit-type selection is unavailable in this host.</span>
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
              Default settings for this edit type are loaded from the supported template.
            </p>
            <details>
              <summary className="ui-text-small ui-text-secondary">Advanced template metadata</summary>
              <p className="ui-text-small ui-text-secondary" style={{ marginTop: "0.5rem" }}>
                Workflow ID: {selectedWorkflowDetail.workflowId}
                {" | "}
                Version: {selectedWorkflowDetail.version.versionTag}
                {" | "}
                Operation kind: {selectedWorkflowDetail.operationKind}
              </p>
            </details>
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
            <span className="ui-field__label">Linked image system id</span>
            <input className="ui-input" value={defaults.imageSystemDefinitionId ?? ""} readOnly />
          </label>
          <p className="ui-text-small ui-text-secondary">Current draft id: {draft.draftId}</p>
        </div>
      </details>

      {status ? <p className="ui-text-small ui-text-secondary">{status}</p> : null}
    </section>
  );
}
