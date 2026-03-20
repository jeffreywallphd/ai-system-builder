import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ContextPreviewResult } from "../../application/context/models/ContextPreview";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import ContextWorkbench, { type ContextWorkbenchMode } from "../components/context/ContextWorkbench";
import { useUiDependencies } from "../composition/AppProviders";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import type { IWorkflowStoreState } from "../state/WorkflowStore";

const fallbackWorkflowState: IWorkflowStoreState = Object.freeze({
  workflows: Object.freeze([]),
  currentWorkflow: undefined,
  validation: undefined,
  selectedNodeId: undefined,
  selectedConnectionId: undefined,
  isDirty: false,
  isLoading: false,
  isSaving: false,
  lastSavedAt: undefined,
  saveError: undefined,
  actionHistory: Object.freeze({
    entries: Object.freeze([]),
    canUndo: false,
    canRedo: false,
  }),
  isExecuting: false,
  lastExecutionEvent: undefined,
  nodeExecutionOutputs: Object.freeze({}),
  outputAssets: Object.freeze([]),
  error: undefined,
});

function unique(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))]);
}

function getInitialRecipeIds(workflow?: IWorkflow): ReadonlyArray<string> {
  const config = workflow?.metadata.contextConfiguration;
  return unique(config?.selectedRecipeIds ?? config?.recipeSelections?.map((selection) => selection.recipeId) ?? []);
}

function getInitialPackageIds(workflow?: IWorkflow): ReadonlyArray<string> {
  const config = workflow?.metadata.contextConfiguration;
  return unique(config?.selectedPackageIds ?? config?.packageReferences?.map((reference) => reference.packageId) ?? []);
}

export default function ContextWorkbenchPage(): JSX.Element {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { workflowStore, contextService } = useUiDependencies();
  const [workflowState, setWorkflowState] = useState<IWorkflowStoreState>(fallbackWorkflowState);
  const [mode, setMode] = useState<ContextWorkbenchMode>("workflow");
  const [preview, setPreview] = useState<ContextPreviewResult>();
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string>();
  const [visibilityMode, setVisibilityMode] = useState<"basic" | "advanced">("advanced");
  const [maxCharacters, setMaxCharacters] = useState<number | undefined>();
  const [maxTokens, setMaxTokens] = useState<number | undefined>();
  const [trimPartialFragments, setTrimPartialFragments] = useState(true);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<ReadonlyArray<string>>([]);
  const [selectedPackageIds, setSelectedPackageIds] = useState<ReadonlyArray<string>>([]);

  useEffect(() => workflowStore.subscribe(setWorkflowState), [workflowStore]);

  useEffect(() => {
    if (!workflowId) {
      return;
    }

    void workflowStore.loadWorkflow(workflowId).catch(() => undefined);
  }, [workflowId, workflowStore]);

  const workflow = workflowState.currentWorkflow?.id === workflowId ? workflowState.currentWorkflow : undefined;

  useEffect(() => {
    if (!workflow) {
      return;
    }

    const config = workflow.metadata.contextConfiguration;
    setVisibilityMode(config?.visibilityMode ?? "advanced");
    setMaxCharacters(config?.maxCharacters);
    setMaxTokens(config?.maxTokens);
    setTrimPartialFragments(config?.trimPartialFragments ?? true);
    setSelectedRecipeIds(getInitialRecipeIds(workflow));
    setSelectedPackageIds(getInitialPackageIds(workflow));
    setMode((currentMode) => (currentMode === "tool" && !workflow.metadata.isPublishedAsTool ? "workflow" : currentMode));
  }, [workflow?.id]);

  const previewRequest = useMemo(() => {
    if (!workflow) {
      return undefined;
    }

    return {
      workflow,
      selectedRecipeIds,
      selectedPackageIds,
      visibilityMode,
      maxCharacters,
      maxTokens,
      trimPartialFragments,
    } as const;
  }, [workflow, selectedRecipeIds, selectedPackageIds, visibilityMode, maxCharacters, maxTokens, trimPartialFragments]);

  useEffect(() => {
    if (!workflow || !previewRequest) {
      setPreview(undefined);
      return;
    }

    let isActive = true;
    setIsPreviewLoading(true);
    setPreviewError(undefined);

    const loadPreview = async (): Promise<void> => {
      try {
        const nextPreview = mode === "tool"
          ? await contextService.previewToolContext({
              toolId: workflow.id,
              selectedRecipeIds,
              selectedPackageIds,
              visibilityMode,
              maxCharacters,
              maxTokens,
              trimPartialFragments,
            })
          : mode === "agent"
            ? await contextService.previewAgentContext(previewRequest)
            : await contextService.previewWorkflowContext(previewRequest);

        if (!isActive) {
          return;
        }

        setPreview(nextPreview);
      } catch (error: unknown) {
        if (isActive) {
          setPreview(undefined);
          setPreviewError(error instanceof Error ? error.message : "Failed to load context preview.");
        }
      } finally {
        if (isActive) {
          setIsPreviewLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      isActive = false;
    };
  }, [contextService, mode, previewRequest, workflow, selectedRecipeIds, selectedPackageIds, visibilityMode, maxCharacters, maxTokens, trimPartialFragments]);

  return (
    <section className="ui-page" data-testid="context-workbench-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Context Workbench</h1>
          <p className="ui-page__subtitle">
            Preview exactly how workflow-bound context assembles, trims, and reaches prompts, tools, agents, and MCP-backed capabilities.
          </p>
          <p className="ui-text-secondary ui-text-small">
            This author surface stays separate from the end-user Tools flow so authors can debug context without exposing internal complexity.
          </p>
          <div className="ui-row ui-row--wrap">
            <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.workflows}>Back to workflows</Link>
            {workflowId ? <Link className="ui-button ui-button--ghost ui-button--sm" to={`/workflows/${workflowId}`}>Return to editor</Link> : null}
          </div>
        </div>
      </div>

      {!workflow ? (
        <div className="ui-panel">
          <div className="ui-panel__body ui-text-secondary">
            {workflowState.isLoading ? "Loading workflow…" : "Select a workflow to inspect its context workbench."}
          </div>
        </div>
      ) : (
        <ContextWorkbench
          workflow={workflow}
          mode={mode}
          preview={preview}
          isLoading={isPreviewLoading}
          error={previewError}
          visibilityMode={visibilityMode}
          maxCharacters={maxCharacters}
          maxTokens={maxTokens}
          trimPartialFragments={trimPartialFragments}
          selectedRecipeIds={selectedRecipeIds}
          selectedPackageIds={selectedPackageIds}
          onModeChange={setMode}
          onVisibilityModeChange={setVisibilityMode}
          onMaxCharactersChange={setMaxCharacters}
          onMaxTokensChange={setMaxTokens}
          onTrimPartialFragmentsChange={setTrimPartialFragments}
          onToggleRecipe={(recipeId, checked) => {
            setSelectedRecipeIds((current) =>
              checked ? unique([...current, recipeId]) : current.filter((value) => value !== recipeId)
            );
          }}
          onTogglePackage={(packageId, checked) => {
            setSelectedPackageIds((current) =>
              checked ? unique([...current, packageId]) : current.filter((value) => value !== packageId)
            );
          }}
        />
      )}
    </section>
  );
}
