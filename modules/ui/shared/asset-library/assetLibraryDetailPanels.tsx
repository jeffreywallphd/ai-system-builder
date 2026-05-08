import { useId, useMemo, useState, type ReactNode } from "react";

import type { AssetMetadata } from "../../../contracts/asset";
import type { AssetLibraryDefinitionDetail } from "./assetLibraryReadModels";
import {
  displayAssetLibraryValue,
  formatAssetLibraryBoolean,
  formatAssetLibraryDate,
  formatAssetLibraryLabel,
  getAssetLibraryFamilyLabel,
  getAssetLibraryLifecycleStatusLabel,
  getAssetLibraryTypeLabel,
} from "./assetLibraryPresentation";

export type AssetLibraryAdvancedSectionKey =
  | "aiContext"
  | "configuration"
  | "ports"
  | "requirements"
  | "provenance"
  | "validation"
  | "metadata";

export interface AssetLibraryDetailRowModel {
  readonly label: string;
  readonly value: string | number | undefined;
}

export interface AssetLibraryAdvancedSectionModel {
  readonly key: AssetLibraryAdvancedSectionKey;
  readonly title: string;
  readonly summary?: string;
  readonly rows: readonly AssetLibraryDetailRowModel[];
  readonly note?: string;
  readonly metadata?: AssetMetadata;
}

export interface AssetLibraryDefinitionDetailViewProps {
  readonly detail?: AssetLibraryDefinitionDetail;
  readonly isLoading: boolean;
  readonly isLoadingValidation: boolean;
  readonly error?: string;
  readonly validationError?: string;
  readonly onLoadValidationDetails: () => void;
}

const COLLAPSED_SECTIONS: Readonly<Record<AssetLibraryAdvancedSectionKey, boolean>> = {
  aiContext: false,
  configuration: false,
  ports: false,
  requirements: false,
  provenance: false,
  validation: false,
  metadata: false,
};

function joined(values: readonly string[]): string | undefined {
  return values.length > 0 ? values.join(", ") : undefined;
}

export function buildAssetLibraryAdvancedSections(
  detail: AssetLibraryDefinitionDetail | undefined,
): readonly AssetLibraryAdvancedSectionModel[] {
  if (!detail) return [];

  const sections: AssetLibraryAdvancedSectionModel[] = [];

  if (detail.aiContextSummary) {
    sections.push({
      key: "aiContext",
      title: "AI-readable context",
      summary: "Summary only. Full prompt context is not shown here.",
      rows: [
        { label: "What this is for", value: detail.aiContextSummary.purpose },
        { label: "User summary", value: detail.aiContextSummary.userFacingSummary },
        { label: "Developer summary", value: detail.aiContextSummary.developerFacingSummary },
        { label: "What it can do", value: detail.aiContextSummary.capabilityCount },
        { label: "Limitations", value: detail.aiContextSummary.limitationCount },
        { label: "Limits and safety notes", value: detail.aiContextSummary.safetyNoteCount },
      ],
    });
  }

  if (detail.configurationSummary) {
    sections.push({
      key: "configuration",
      title: "Configuration",
      summary: "Read-only summary. This is not an editable setup form.",
      rows: [
        { label: "Schema ID", value: detail.configurationSummary.schemaId },
        { label: "Schema version", value: detail.configurationSummary.schemaVersion },
        { label: "Fields", value: detail.configurationSummary.fieldCount },
        { label: "Required fields", value: detail.configurationSummary.requiredFieldCount },
        { label: "Strict mode", value: formatAssetLibraryBoolean(detail.configurationSummary.strict) },
        { label: "Description", value: detail.configurationSummary.description },
      ],
    });
  }

  if (detail.portsSummary) {
    sections.push({
      key: "ports",
      title: "Inputs and outputs",
      summary: "Connection points this building block describes.",
      rows: [
        { label: "Total ports", value: detail.portsSummary.totalCount },
        { label: "Inputs", value: detail.portsSummary.inputCount },
        { label: "Outputs", value: detail.portsSummary.outputCount },
        { label: "Events", value: detail.portsSummary.eventCount },
        { label: "Actions or controls", value: detail.portsSummary.controlCount },
      ],
    });
  }

  if (detail.requirementsSummary) {
    sections.push({
      key: "requirements",
      title: "Requirements",
      summary: "Declared needs only. This does not check whether a runtime is currently available.",
      rows: [
        { label: "Total requirements", value: detail.requirementsSummary.totalCount },
        { label: "Required", value: detail.requirementsSummary.requiredCount },
        { label: "Runtime needs", value: joined(detail.requirementsSummary.runtimeCapabilityIds) },
        { label: "Where it can run", value: joined(detail.requirementsSummary.hostKinds) },
        { label: "Safety", value: joined(detail.requirementsSummary.safetyStatuses) },
      ],
    });
  }

  if (detail.provenanceSummary) {
    sections.push({
      key: "provenance",
      title: "Source",
      summary: "Safe origin and authorship details.",
      rows: [
        { label: "Source kind", value: formatAssetLibraryLabel(detail.provenanceSummary.sourceKind) },
        { label: "Authorship", value: formatAssetLibraryLabel(detail.provenanceSummary.authorship) },
        { label: "Created", value: formatAssetLibraryDate(detail.provenanceSummary.createdAt) },
        { label: "Updated", value: formatAssetLibraryDate(detail.provenanceSummary.updatedAt) },
        { label: "Generation summary", value: detail.provenanceSummary.redactedGenerationSummary },
      ],
    });
  }

  if (detail.validationSummary) {
    sections.push({
      key: "validation",
      title: "Validation summary",
      summary: "Registry validation details loaded on request.",
      rows: [
        { label: "Status", value: formatAssetLibraryLabel(detail.validationSummary.status) },
        { label: "Issues", value: detail.validationSummary.issueCount },
        { label: "Errors", value: detail.validationSummary.errorCount },
        { label: "Warnings", value: detail.validationSummary.warningCount },
        { label: "Checked", value: formatAssetLibraryDate(detail.validationSummary.validatedAt) },
      ],
    });
  }

  if (detail.metadata) {
    sections.push({
      key: "metadata",
      title: "Details",
      summary: "Sensitive or unsafe metadata is omitted.",
      note: "Sensitive or unsafe metadata is omitted",
      rows: [],
      metadata: detail.metadata,
    });
  }

  return sections;
}

export function getAssetLibraryAdvancedSections(
  detail: AssetLibraryDefinitionDetail | undefined,
): readonly AssetLibraryAdvancedSectionKey[] {
  return buildAssetLibraryAdvancedSections(detail).map((section) => section.key);
}

export function AssetLibraryEmptyValue() {
  return <span className="asset-library-empty-value">Not specified</span>;
}

export function AssetLibraryBadge({
  children,
  tone,
}: {
  readonly children: ReactNode;
  readonly tone?: "system" | "custom";
}) {
  const toneClass = tone ? `asset-library-badge--${tone}` : undefined;
  return (
    <span className={["asset-library-badge", toneClass].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}

export function AssetLibraryDetailRow({ label, value }: AssetLibraryDetailRowModel) {
  const displayValue = displayAssetLibraryValue(value);
  return (
    <div className="asset-library-definition-row">
      <dt>{label}</dt>
      <dd>{displayValue === "Not specified" ? <AssetLibraryEmptyValue /> : displayValue}</dd>
    </div>
  );
}

export function AssetLibraryDetailSection({
  title,
  children,
  className,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section className={["asset-library-detail__section", className].filter(Boolean).join(" ")}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function AssetLibraryMetadataView({ metadata }: { readonly metadata: AssetMetadata }) {
  return (
    <pre className="asset-library-metadata" aria-label="Safe metadata">
      {JSON.stringify(metadata, null, 2)}
    </pre>
  );
}

export function AssetLibraryAdvancedPanel({
  section,
  isExpanded,
  onToggle,
}: {
  readonly section: AssetLibraryAdvancedSectionModel;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
}) {
  const autoContentId = useId();

  return (
    <section className="ui-panel ui-panel--collapsible asset-library-advanced-panel">
      <button
        className="ui-panel__toggle"
        type="button"
        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${section.title}`}
        aria-expanded={isExpanded}
        aria-controls={autoContentId}
        onClick={onToggle}
      >
        <span className="ui-panel__title">{section.title}</span>
        <span className="ui-panel__chevron" aria-hidden="true">
          {isExpanded ? "-" : "+"}
        </span>
      </button>
      <div id={autoContentId} className="ui-panel__body" hidden={!isExpanded}>
        {section.summary ? <p className="asset-library-panel-note">{section.summary}</p> : null}
        {section.rows.length > 0 ? (
          <dl className="asset-library-definition-grid">
            {section.rows.map((row) => (
              <AssetLibraryDetailRow key={`${section.key}-${row.label}`} label={row.label} value={row.value} />
            ))}
          </dl>
        ) : null}
        {section.note ? <p className="asset-library-panel-note">{section.note}</p> : null}
        {section.metadata ? <AssetLibraryMetadataView metadata={section.metadata} /> : null}
      </div>
    </section>
  );
}

export function AssetLibraryDefinitionDetailView({
  detail,
  isLoading,
  isLoadingValidation,
  error,
  validationError,
  onLoadValidationDetails,
}: AssetLibraryDefinitionDetailViewProps) {
  const [expandedSections, setExpandedSections] = useState(COLLAPSED_SECTIONS);
  const advancedSections = useMemo(() => buildAssetLibraryAdvancedSections(detail), [detail]);

  const toggleSection = (section: AssetLibraryAdvancedSectionKey) => {
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
          <p>{detail.summary ?? detail.overview?.description ?? "Reusable building block."}</p>
        </div>
        <AssetLibraryBadge tone={detail.builtIn ? "system" : "custom"}>
          {detail.builtIn ? "Built-in" : "Custom"}
        </AssetLibraryBadge>
      </div>

      <AssetLibraryDetailSection title="Overview">
        <dl className="asset-library-definition-grid">
          <AssetLibraryDetailRow label="Short summary" value={detail.summary ?? detail.overview?.description} />
          <AssetLibraryDetailRow label="Type" value={getAssetLibraryTypeLabel(detail)} />
          <AssetLibraryDetailRow label="Family" value={getAssetLibraryFamilyLabel(detail)} />
          <AssetLibraryDetailRow label="Status" value={getAssetLibraryLifecycleStatusLabel(detail)} />
          <AssetLibraryDetailRow label="Version" value={`v${detail.version}`} />
          <AssetLibraryDetailRow label="Source" value={detail.builtIn ? "Built-in" : "Custom"} />
          <AssetLibraryDetailRow label="Review" value={formatAssetLibraryLabel(detail.overview?.reviewStatus)} />
        </dl>
      </AssetLibraryDetailSection>

      {advancedSections.length > 0 ? (
        <AssetLibraryDetailSection title="Advanced Details" className="asset-library-detail__advanced">
          {advancedSections.map((section) => (
            <AssetLibraryAdvancedPanel
              key={section.key}
              section={section}
              isExpanded={expandedSections[section.key]}
              onToggle={() => toggleSection(section.key)}
            />
          ))}
        </AssetLibraryDetailSection>
      ) : null}

      <AssetLibraryDetailSection title="Validation details">
        {!detail.validationSummary ? (
          <p className="asset-library-panel-note">Validation details are loaded only when requested.</p>
        ) : null}
        <button
          className="ui-button"
          type="button"
          onClick={onLoadValidationDetails}
          disabled={isLoadingValidation}
        >
          {isLoadingValidation ? "Checking validation details..." : "Check validation details"}
        </button>
        {isLoadingValidation ? <p className="ui-status" role="status">Loading validation details...</p> : null}
        {validationError ? <p className="ui-status" role="alert">{validationError}</p> : null}
      </AssetLibraryDetailSection>
    </section>
  );
}
