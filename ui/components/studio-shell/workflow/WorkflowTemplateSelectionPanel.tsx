import { useEffect, useMemo, useState } from "react";
import { CoreImageStarterWorkflowTemplates } from "../../../../application/workflow-template-studio/CoreImageStarterWorkflowTemplates";
import { WorkflowTemplateInstantiationService } from "../../../../application/workflow-template-studio/WorkflowTemplateInstantiationService";
import type { WorkflowTemplateDefinition } from "../../../../src/domain/workflow-template-studio/WorkflowTemplateDomain";
import { RegistryService } from "../../../services/RegistryService";

interface WorkflowTemplateSelectionPanelProps {
  readonly surface: "workflow-studio" | "system-studio";
}

interface TemplateEntry {
  readonly templateId: string;
  readonly versionId?: string;
  readonly name: string;
  readonly summary?: string;
  readonly category: string;
  readonly supportedIntent: string;
}

const fallbackById = new Map(CoreImageStarterWorkflowTemplates.map((entry) => [entry.templateId, entry] as const));

function summarizeIo(template: WorkflowTemplateDefinition): string {
  return `${template.inputRequirements.length} input(s) • ${template.outputExpectations.length} output(s)`;
}

export default function WorkflowTemplateSelectionPanel({ surface }: WorkflowTemplateSelectionPanelProps): JSX.Element {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [instantiatedSnapshot, setInstantiatedSnapshot] = useState<string>("");
  const [templates, setTemplates] = useState<ReadonlyArray<TemplateEntry>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let disposed = false;
    const registry = new RegistryService();

    void registry.filterAssets({ semanticRoles: ["workflow-template"], limit: 200 })
      .then((response) => {
        if (disposed) return;
        const entries = response.ok && response.data
          ? response.data.map((entry) => Object.freeze({
            templateId: entry.assetId,
            versionId: entry.versionId,
            name: entry.name?.trim() || entry.assetId,
            summary: entry.description,
            category: entry.metadata?.tags?.find((tag) => ["transform", "enhancement"].includes(tag))
              ?? fallbackById.get(entry.assetId)?.metadata.category
              ?? "workflow-template",
            supportedIntent: fallbackById.get(entry.assetId)?.metadata.intent
              ?? "image-to-image",
          }))
          : CoreImageStarterWorkflowTemplates.map((entry) => Object.freeze({
            templateId: entry.templateId,
            versionId: entry.versionId,
            name: entry.name,
            summary: entry.summary,
            category: entry.metadata.category ?? entry.category,
            supportedIntent: entry.metadata.intent ?? entry.supportedIntent,
          }));
        setTemplates(entries);
        setSelectedTemplateId(entries[0]?.templateId ?? "");
      })
      .finally(() => {
        if (!disposed) {
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  const categories = useMemo(
    () => ["all", ...new Set(templates.map((entry) => entry.category))],
    [templates],
  );
  const filtered = useMemo(
    () => templates.filter((entry) => categoryFilter === "all" || entry.category === categoryFilter),
    [categoryFilter, templates],
  );
  const selected = filtered.find((entry) => entry.templateId === selectedTemplateId) ?? filtered[0];
  const selectedDefinition = selected ? fallbackById.get(selected.templateId) : undefined;

  const preview = useMemo(() => {
    if (!selected || !selectedDefinition) {
      return undefined;
    }
    return {
      templateId: selectedDefinition.templateId,
      versionId: selectedDefinition.versionId,
      name: selectedDefinition.name,
      category: selectedDefinition.metadata.category ?? selectedDefinition.category,
      description: selectedDefinition.summary,
      expectedInputs: selectedDefinition.inputRequirements,
      outputs: selectedDefinition.outputExpectations,
      parameters: selectedDefinition.parameters ?? [],
    };
  }, [selected, selectedDefinition]);

  return (
    <section className="ui-stack ui-stack--sm" data-testid="workflow-template-selection-panel">
      <div className="ui-row ui-row--between ui-row--wrap">
        <strong>Workflow template starter selection</strong>
        <span className="ui-text-small ui-text-secondary">{surface === "workflow-studio" ? "Workflow Studio" : "System Studio"}</span>
      </div>
      <label className="ui-field">
        <span className="ui-field__label">Template category</span>
        <select
          className="ui-select"
          value={categoryFilter}
          onChange={(event) => {
            const next = event.target.value;
            setCategoryFilter(next);
            const first = templates.find((entry) => next === "all" || entry.category === next);
            setSelectedTemplateId(first?.templateId ?? "");
          }}
        >
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>

      {loading ? <div className="ui-text-small ui-text-secondary">Loading templates…</div> : null}

      <div className="ui-template-selection-grid">
        <ul className="ui-stack ui-stack--2xs" role="listbox" aria-label="Workflow templates">
          {filtered.map((template) => {
            const definition = fallbackById.get(template.templateId);
            return (
              <li key={template.templateId}>
                <button
                  type="button"
                  className={`ui-button ui-button--ghost ui-template-selection-card ${selected?.templateId === template.templateId ? "ui-template-selection-card--active" : ""}`}
                  onClick={() => setSelectedTemplateId(template.templateId)}
                >
                  <span className="ui-template-selection-card__title">{template.name}</span>
                  <span className="ui-text-small ui-text-muted">{template.summary}</span>
                  <span className="ui-text-small ui-text-secondary">{template.category} • {definition ? summarizeIo(definition) : "inspectable"}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {preview ? (
          <article className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-template-preview">
            <strong>{preview.name}</strong>
            <p className="ui-text-small ui-text-muted">{preview.description}</p>
            <p className="ui-text-small">Category: {preview.category}</p>
            <p className="ui-text-small">Inputs: {preview.expectedInputs.map((entry) => entry.inputId).join(", ")}</p>
            <p className="ui-text-small">Outputs: {preview.outputs.map((entry) => entry.outputId).join(", ")}</p>
            <p className="ui-text-small">Parameters: {preview.parameters.map((entry) => entry.parameterId).join(", ") || "none"}</p>
            <button
              type="button"
              className="ui-button ui-button--primary ui-button--sm"
              onClick={() => {
                setInstantiatedSnapshot(JSON.stringify({
                  templateId: preview.templateId,
                  versionId: preview.versionId,
                  preparedAt: new Date().toISOString(),
                  preparedConfiguration: {
                    inputIds: preview.expectedInputs.map((entry) => entry.inputId),
                    outputIds: preview.outputs.map((entry) => entry.outputId),
                    parameterDefaults: Object.fromEntries(preview.parameters.map((entry) => [entry.parameterId, entry.defaultValue ?? null])),
                  },
                  source: WorkflowTemplateInstantiationService.name,
                }, null, 2));
              }}
            >
              Instantiate template configuration
            </button>
          </article>
        ) : (
          <article className="ui-card ui-card--padded ui-text-small ui-text-muted">Template preview is unavailable for this selection.</article>
        )}
      </div>

      {instantiatedSnapshot ? (
        <details>
          <summary className="ui-text-small">Latest instantiated configuration</summary>
          <pre className="ui-code-block">{instantiatedSnapshot}</pre>
        </details>
      ) : null}
    </section>
  );
}
