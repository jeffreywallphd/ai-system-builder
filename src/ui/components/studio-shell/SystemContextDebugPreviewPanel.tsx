import { useMemo } from "react";
import { SystemContextDebugPreviewService } from "@application/workflow-studio/SystemContextDebugPreviewService";
import type { SystemStudioContextExtractionSource } from "@application/workflow-studio/SystemStudioContextExtraction";
import type { SystemContextValidationRequest } from "@application/workflow-studio/SystemContextValidationService";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";

interface SystemSpecContent {
  readonly parameters?: ReadonlyArray<{
    readonly parameterId: string;
    readonly required?: boolean;
    readonly defaultValue?: unknown;
  }>;
}

function parseSystemSpec(content: string): SystemSpecContent {
  try {
    if (!content.trim()) {
      return Object.freeze({});
    }
    const parsed = JSON.parse(content) as { readonly systemSpec?: SystemSpecContent };
    return parsed.systemSpec ?? Object.freeze({});
  } catch {
    return Object.freeze({});
  }
}

function buildSourceFromDraft(context: StudioShellExtensionContext): SystemStudioContextExtractionSource {
  const draft = context.snapshot?.draft;
  const spec = parseSystemSpec(draft?.content ?? "");
  const parameterValues = Object.fromEntries(
    (spec.parameters ?? [])
      .filter((parameter) => typeof parameter.parameterId === "string" && parameter.parameterId.trim().length > 0)
      .map((parameter) => [parameter.parameterId.trim(), parameter.defaultValue]),
  );

  return Object.freeze({
    selectedImages: Object.freeze([]),
    parameterValues: Object.freeze(parameterValues),
    datasets: Object.freeze((draft?.dependencies ?? []).map((dependency, index) => Object.freeze({
      referenceId: `draft-dependency-${index + 1}`,
      datasetAssetId: dependency.assetId,
      datasetVersionId: dependency.versionId,
      role: "active-input",
      metadata: Object.freeze({
        source: "system-draft-dependency",
      }),
    }))),
    runtime: Object.freeze({
      runtimeSessionId: context.snapshot?.activeSessionId,
      systemAssetId: draft?.assetId,
      sourceStudio: "system-studio",
    }),
    extensions: Object.freeze({
      draftId: draft?.draftId,
      draftRevision: draft?.revision,
    }),
  });
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function SystemContextDebugPreviewPanel({ context }: { readonly context: StudioShellExtensionContext }): JSX.Element {
  const previewService = useMemo(() => new SystemContextDebugPreviewService(), []);
  const draft = context.snapshot?.draft;
  const source = buildSourceFromDraft(context);
  const validationRequest: Omit<SystemContextValidationRequest, "context"> = Object.freeze({
    requiredParameterKeys: parseSystemSpec(draft?.content ?? "").parameters
      ?.filter((parameter) => parameter.required)
      .map((parameter) => parameter.parameterId),
    mediaSchema: Object.freeze({
      required: true,
      requireAssetReference: true,
    }),
  });

  const preview = previewService.preview({
    source,
    validation: validationRequest,
  });

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-context-debug-preview-panel">
      <div className="ui-stack ui-stack--2xs">
        <strong>System context preview + debug</strong>
        <span className="ui-text-small ui-text-secondary">
          Inspect UI-state extraction, normalized context, validation alignment, dataset resolution, and enriched workflow trigger payload shape before dispatch.
        </span>
      </div>

      <div className="ui-stack ui-stack--2xs">
        <div><strong>Draft:</strong> {draft?.draftId ?? "none"}</div>
        <div><strong>Context valid:</strong> {preview.validation.valid ? "yes" : "no"}</div>
        <div><strong>Blocking issues:</strong> {preview.validation.blockingIssues.length}</div>
        <div><strong>Warnings:</strong> {preview.validation.warningIssues.length}</div>
      </div>

      {preview.extractionIssues.length > 0 ? (
        <div className="ui-stack ui-stack--2xs">
          <strong>Extraction issues</strong>
          {preview.extractionIssues.map((issue) => (
            <div key={`${issue.code}:${issue.path ?? "root"}`} className="ui-text-small ui-text-secondary">
              [{issue.severity}] {issue.code}: {issue.message}
            </div>
          ))}
        </div>
      ) : null}

      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Normalized system context</span>
        <textarea className="ui-textarea" rows={8} readOnly value={stringify(preview.validation.normalizedContext)} />
      </label>

      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Dataset resolution output</span>
        <textarea className="ui-textarea" rows={8} readOnly value={stringify(preview.datasetResolution)} />
      </label>

      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Workflow context binding output</span>
        <textarea className="ui-textarea" rows={8} readOnly value={stringify(preview.workflowContext)} />
      </label>

      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Enriched trigger payload preview</span>
        <textarea className="ui-textarea" rows={10} readOnly value={stringify(preview.enrichedTriggerPayload)} />
      </label>
    </div>
  );
}

