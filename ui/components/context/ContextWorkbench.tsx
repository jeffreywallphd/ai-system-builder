import type { IWorkflow } from "../../../domain/workflows/interfaces/IWorkflow";
import type { ContextPreviewResult } from "../../../application/context/models/ContextPreview";
import ContextBudgetPanel from "./ContextBudgetPanel";
import ContextPreviewPanel from "./ContextPreviewPanel";
import ContextProvenanceTable from "./ContextProvenanceTable";

export type ContextWorkbenchMode = "workflow" | "tool" | "agent";

export interface ContextWorkbenchProps {
  readonly workflow: IWorkflow;
  readonly mode: ContextWorkbenchMode;
  readonly preview?: ContextPreviewResult;
  readonly isLoading?: boolean;
  readonly error?: string;
  readonly visibilityMode: "basic" | "advanced";
  readonly maxCharacters?: number;
  readonly maxTokens?: number;
  readonly trimPartialFragments: boolean;
  readonly selectedRecipeIds: ReadonlyArray<string>;
  readonly selectedPackageIds: ReadonlyArray<string>;
  readonly onModeChange?: (mode: ContextWorkbenchMode) => void;
  readonly onVisibilityModeChange?: (value: "basic" | "advanced") => void;
  readonly onMaxCharactersChange?: (value?: number) => void;
  readonly onMaxTokensChange?: (value?: number) => void;
  readonly onTrimPartialFragmentsChange?: (value: boolean) => void;
  readonly onToggleRecipe?: (recipeId: string, checked: boolean) => void;
  readonly onTogglePackage?: (packageId: string, checked: boolean) => void;
}

function getRecipeSelections(workflow: IWorkflow) {
  return workflow.metadata.contextConfiguration?.recipeSelections ?? [];
}

function getPackageReferences(workflow: IWorkflow) {
  return workflow.metadata.contextConfiguration?.packageReferences ?? [];
}

export default function ContextWorkbench({
  workflow,
  mode,
  preview,
  isLoading,
  error,
  visibilityMode,
  maxCharacters,
  maxTokens,
  trimPartialFragments,
  selectedRecipeIds,
  selectedPackageIds,
  onModeChange,
  onVisibilityModeChange,
  onMaxCharactersChange,
  onMaxTokensChange,
  onTrimPartialFragmentsChange,
  onToggleRecipe,
  onTogglePackage,
}: ContextWorkbenchProps): JSX.Element {
  const recipeSelections = getRecipeSelections(workflow).filter((selection) => selection.isEnabled !== false);
  const packageReferences = getPackageReferences(workflow).filter((reference) => reference.isEnabled !== false);
  const isToolModeAvailable = Boolean(workflow.metadata.isPublishedAsTool);

  return (
    <div className="ui-stack ui-stack--lg" data-testid="context-workbench">
      <section className="ui-panel">
        <div className="ui-panel__header">
          <div>
            <div className="ui-panel__title">Context Workbench</div>
            <div className="ui-panel__subtitle">
              Author-only preview surface for package bindings, assembly, trimming, provenance, and execution delivery.
            </div>
          </div>
        </div>

        <div className="ui-panel__body ui-stack ui-stack--md">
          <div className="ui-button-group" role="tablist" aria-label="Context preview path">
            <button
              type="button"
              className={`ui-button ui-button--sm ${mode === "workflow" ? "ui-button--primary" : "ui-button--ghost"}`}
              onClick={() => onModeChange?.("workflow")}
            >
              Workflow path
            </button>
            <button
              type="button"
              className={`ui-button ui-button--sm ${mode === "tool" ? "ui-button--primary" : "ui-button--ghost"}`}
              onClick={() => onModeChange?.("tool")}
              disabled={!isToolModeAvailable}
            >
              Tool path
            </button>
            <button
              type="button"
              className={`ui-button ui-button--sm ${mode === "agent" ? "ui-button--primary" : "ui-button--ghost"}`}
              onClick={() => onModeChange?.("agent")}
            >
              Agent path
            </button>
          </div>

          {!isToolModeAvailable ? (
            <div className="ui-text-small ui-text-secondary">
              Publish this workflow as a tool to preview the end-user-safe tool context path.
            </div>
          ) : null}

          <div className="ui-grid ui-grid--2col" style={{ gap: "var(--ui-space-4)" }}>
            <div className="ui-stack ui-stack--sm">
              <div className="ui-meta-label">Recipe bindings</div>
              {recipeSelections.length === 0 ? (
                <div className="ui-text-small ui-text-secondary">No workflow recipes are bound.</div>
              ) : (
                recipeSelections.map((selection) => (
                  <label key={selection.recipeId} className="ui-row ui-row--wrap">
                    <input
                      type="checkbox"
                      checked={selectedRecipeIds.includes(selection.recipeId)}
                      onChange={(event) => onToggleRecipe?.(selection.recipeId, event.target.checked)}
                    />
                    <span>
                      {selection.alias ?? selection.recipeId}
                      {selection.surfaceInTool === false ? " (author only)" : ""}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="ui-stack ui-stack--sm">
              <div className="ui-meta-label">Package bindings</div>
              {packageReferences.length === 0 ? (
                <div className="ui-text-small ui-text-secondary">No workflow packages are bound.</div>
              ) : (
                packageReferences.map((reference) => (
                  <label key={reference.packageId} className="ui-row ui-row--wrap">
                    <input
                      type="checkbox"
                      checked={selectedPackageIds.includes(reference.packageId)}
                      onChange={(event) => onTogglePackage?.(reference.packageId, event.target.checked)}
                    />
                    <span>{reference.alias ?? reference.packageId}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <ContextBudgetPanel
        inspection={preview?.inspection}
        visibilityMode={visibilityMode}
        maxCharacters={maxCharacters}
        maxTokens={maxTokens}
        trimPartialFragments={trimPartialFragments}
        onVisibilityModeChange={onVisibilityModeChange}
        onMaxCharactersChange={onMaxCharactersChange}
        onMaxTokensChange={onMaxTokensChange}
        onTrimPartialFragmentsChange={onTrimPartialFragmentsChange}
      />

      {error ? <div className="ui-banner ui-banner--danger">{error}</div> : null}
      {isLoading ? <div className="ui-text-secondary">Refreshing preview…</div> : null}

      <ContextPreviewPanel preview={preview} />
      <ContextProvenanceTable preview={preview} />
    </div>
  );
}
