import { useMemo, useState } from "react";

import { CollapsiblePanel } from "../../../components/ui/CollapsiblePanel";
import type { AssetLibraryDefinitionDetail } from "../../../../../../../modules/ui/shared/asset-library";

interface AssetDefinitionDetailPanelProps {
  readonly detail?: AssetLibraryDefinitionDetail;
  readonly isLoading: boolean;
  readonly error?: string;
}

type AdvancedSectionKey =
  | "aiContext"
  | "configuration"
  | "ports"
  | "requirements"
  | "provenance"
  | "validation"
  | "metadata";

function formatLabel(value: string | undefined): string {
  if (!value) return "Not specified";
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBoolean(value: boolean | undefined): string {
  if (value === undefined) return "Not specified";
  return value ? "Yes" : "No";
}

function formatDate(value: string | undefined): string {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function DefinitionRow({ label, value }: { readonly label: string; readonly value: string | number | undefined }) {
  return (
    <div className="asset-library-definition-row">
      <dt>{label}</dt>
      <dd>{value === undefined || value === "" ? "Not specified" : value}</dd>
    </div>
  );
}

function MetadataView({ metadata }: { readonly metadata: NonNullable<AssetLibraryDefinitionDetail["metadata"]> }) {
  return (
    <pre className="asset-library-metadata" aria-label="Safe metadata">
      {JSON.stringify(metadata, null, 2)}
    </pre>
  );
}

export function AssetDefinitionDetailPanel({ detail, isLoading, error }: AssetDefinitionDetailPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Readonly<Record<AdvancedSectionKey, boolean>>>({
    aiContext: false,
    configuration: false,
    ports: false,
    requirements: false,
    provenance: false,
    validation: false,
    metadata: false,
  });

  const availableAdvancedSections = useMemo(() => {
    if (!detail) return [];
    return [
      detail.aiContextSummary ? "aiContext" : undefined,
      detail.configurationSummary ? "configuration" : undefined,
      detail.portsSummary ? "ports" : undefined,
      detail.requirementsSummary ? "requirements" : undefined,
      detail.provenanceSummary ? "provenance" : undefined,
      detail.validationSummary ? "validation" : undefined,
      detail.metadata ? "metadata" : undefined,
    ].filter((section): section is AdvancedSectionKey => Boolean(section));
  }, [detail]);

  const toggleSection = (section: AdvancedSectionKey) => {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  if (isLoading) {
    return <section className="ui-panel ui-status" role="status">Loading asset details...</section>;
  }

  if (error) {
    return <section className="ui-panel ui-status" role="alert">{error}</section>;
  }

  if (!detail) {
    return (
      <section className="ui-panel asset-library-empty">
        <h2>Select an asset to view details.</h2>
      </section>
    );
  }

  return (
    <section className="ui-panel asset-library-detail" aria-label="Selected asset details">
      <div className="asset-library-detail__header">
        <div>
          <h2>{detail.displayName}</h2>
          <p>{detail.summary ?? detail.overview?.description ?? "Reusable workspace building block."}</p>
        </div>
        <span className={`asset-library-badge ${detail.builtIn ? "asset-library-badge--system" : "asset-library-badge--custom"}`}>
          {detail.builtIn ? "Built-in" : "Custom"}
        </span>
      </div>

      <section className="asset-library-detail__section">
        <h3>Overview</h3>
        <dl className="asset-library-definition-grid">
          <DefinitionRow label="Short summary" value={detail.summary ?? detail.overview?.description} />
          <DefinitionRow label="Type" value={formatLabel(detail.assetType)} />
          <DefinitionRow label="Family" value={formatLabel(detail.assetFamily)} />
          <DefinitionRow label="Status" value={formatLabel(detail.lifecycleStatus)} />
          <DefinitionRow label="Version" value={`v${detail.version}`} />
          <DefinitionRow label="Source" value={detail.builtIn ? "Built-in" : "Custom"} />
          <DefinitionRow label="Review" value={formatLabel(detail.overview?.reviewStatus)} />
        </dl>
      </section>

      <section className="asset-library-detail__section">
        <h3>Identity</h3>
        <dl className="asset-library-definition-grid">
          <DefinitionRow label="Definition ID" value={detail.definitionId} />
          <DefinitionRow label="Reference" value={detail.definitionRef ? `${detail.definitionRef.kind}: ${detail.definitionRef.id}` : undefined} />
        </dl>
      </section>

      {availableAdvancedSections.length > 0 ? (
        <section className="asset-library-detail__section asset-library-detail__advanced">
          <h3>Advanced Details</h3>
          {detail.aiContextSummary ? (
            <CollapsiblePanel title="AI-readable context" isExpanded={expandedSections.aiContext} onToggle={() => toggleSection("aiContext")}>
              <dl className="asset-library-definition-grid">
                <DefinitionRow label="Purpose" value={detail.aiContextSummary.purpose} />
                <DefinitionRow label="User summary" value={detail.aiContextSummary.userFacingSummary} />
                <DefinitionRow label="Developer summary" value={detail.aiContextSummary.developerFacingSummary} />
                <DefinitionRow label="Capabilities" value={detail.aiContextSummary.capabilityCount} />
                <DefinitionRow label="Limitations" value={detail.aiContextSummary.limitationCount} />
                <DefinitionRow label="Safety notes" value={detail.aiContextSummary.safetyNoteCount} />
              </dl>
            </CollapsiblePanel>
          ) : null}

          {detail.configurationSummary ? (
            <CollapsiblePanel title="Configuration" isExpanded={expandedSections.configuration} onToggle={() => toggleSection("configuration")}>
              <dl className="asset-library-definition-grid">
                <DefinitionRow label="Schema ID" value={detail.configurationSummary.schemaId} />
                <DefinitionRow label="Schema version" value={detail.configurationSummary.schemaVersion} />
                <DefinitionRow label="Fields" value={detail.configurationSummary.fieldCount} />
                <DefinitionRow label="Required fields" value={detail.configurationSummary.requiredFieldCount} />
                <DefinitionRow label="Strict" value={formatBoolean(detail.configurationSummary.strict)} />
                <DefinitionRow label="Description" value={detail.configurationSummary.description} />
              </dl>
            </CollapsiblePanel>
          ) : null}

          {detail.portsSummary ? (
            <CollapsiblePanel title="Ports" isExpanded={expandedSections.ports} onToggle={() => toggleSection("ports")}>
              <dl className="asset-library-definition-grid">
                <DefinitionRow label="Total" value={detail.portsSummary.totalCount} />
                <DefinitionRow label="Inputs" value={detail.portsSummary.inputCount} />
                <DefinitionRow label="Outputs" value={detail.portsSummary.outputCount} />
                <DefinitionRow label="Events" value={detail.portsSummary.eventCount} />
                <DefinitionRow label="Controls" value={detail.portsSummary.controlCount} />
              </dl>
            </CollapsiblePanel>
          ) : null}

          {detail.requirementsSummary ? (
            <CollapsiblePanel title="Requirements" isExpanded={expandedSections.requirements} onToggle={() => toggleSection("requirements")}>
              <dl className="asset-library-definition-grid">
                <DefinitionRow label="Total" value={detail.requirementsSummary.totalCount} />
                <DefinitionRow label="Required" value={detail.requirementsSummary.requiredCount} />
                <DefinitionRow label="Runtime capabilities" value={detail.requirementsSummary.runtimeCapabilityIds.join(", ") || undefined} />
                <DefinitionRow label="Hosts" value={detail.requirementsSummary.hostKinds.join(", ") || undefined} />
                <DefinitionRow label="Safety" value={detail.requirementsSummary.safetyStatuses.join(", ") || undefined} />
              </dl>
            </CollapsiblePanel>
          ) : null}

          {detail.provenanceSummary ? (
            <CollapsiblePanel title="Provenance" isExpanded={expandedSections.provenance} onToggle={() => toggleSection("provenance")}>
              <dl className="asset-library-definition-grid">
                <DefinitionRow label="Source kind" value={formatLabel(detail.provenanceSummary.sourceKind)} />
                <DefinitionRow label="Authorship" value={formatLabel(detail.provenanceSummary.authorship)} />
                <DefinitionRow label="Created" value={formatDate(detail.provenanceSummary.createdAt)} />
                <DefinitionRow label="Updated" value={formatDate(detail.provenanceSummary.updatedAt)} />
                <DefinitionRow label="Generation summary" value={detail.provenanceSummary.redactedGenerationSummary} />
              </dl>
            </CollapsiblePanel>
          ) : null}

          {detail.validationSummary ? (
            <CollapsiblePanel title="Validation" isExpanded={expandedSections.validation} onToggle={() => toggleSection("validation")}>
              <dl className="asset-library-definition-grid">
                <DefinitionRow label="Status" value={formatLabel(detail.validationSummary.status)} />
                <DefinitionRow label="Issues" value={detail.validationSummary.issueCount} />
                <DefinitionRow label="Errors" value={detail.validationSummary.errorCount} />
                <DefinitionRow label="Warnings" value={detail.validationSummary.warningCount} />
                <DefinitionRow label="Checked" value={formatDate(detail.validationSummary.validatedAt)} />
              </dl>
            </CollapsiblePanel>
          ) : null}

          {detail.metadata ? (
            <CollapsiblePanel title="Safe metadata" isExpanded={expandedSections.metadata} onToggle={() => toggleSection("metadata")}>
              <MetadataView metadata={detail.metadata} />
            </CollapsiblePanel>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
