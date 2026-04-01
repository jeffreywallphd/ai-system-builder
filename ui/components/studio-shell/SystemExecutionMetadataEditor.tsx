import { useEffect, useState } from "react";
import type { SystemExecutionMetadata } from "../../../domain/system-studio/SystemAssetDomain";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";

interface SystemSpecContent {
  readonly executionMetadata?: SystemExecutionMetadata;
}

interface ExecutionMetadataForm {
  readonly runtimeEnvironment: string;
  readonly runtimeRequirements: string;
  readonly orchestrationMode: string;
  readonly orchestrationHints: string;
  readonly publishVisibility: string;
  readonly publishExportTargets: string;
  readonly profileId: string;
  readonly latencyTier: string;
  readonly ownerTeam: string;
  readonly supportContact: string;
  readonly operationsNotes: string;
  readonly capabilitySelectedModelBindingId: string;
  readonly capabilitySampler: string;
  readonly capabilitySteps: string;
  readonly capabilityGuidanceScale: string;
}

interface JsonParseResult<T> {
  readonly ok: boolean;
  readonly data?: T;
}

type RuntimeCapabilityBindingEnvelope = NonNullable<SystemExecutionMetadata["runtimeCapabilityBindings"]>;
type RuntimeCapabilityBindingRecord = RuntimeCapabilityBindingEnvelope["bindings"] extends ReadonlyArray<infer T> ? T : never;

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

function parseJson<T>(value: string): JsonParseResult<T> {
  try {
    if (!value.trim()) {
      return Object.freeze({ ok: true, data: undefined as T | undefined });
    }
    return Object.freeze({ ok: true, data: JSON.parse(value) as T });
  } catch {
    return Object.freeze({ ok: false });
  }
}

function parseList(value: string): ReadonlyArray<string> | undefined {
  const normalized = [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function formatList(values?: ReadonlyArray<string>): string {
  return (values ?? []).join(", ");
}

function getFirstCapabilityBinding(metadata?: SystemExecutionMetadata): RuntimeCapabilityBindingRecord | undefined {
  return metadata?.runtimeCapabilityBindings?.bindings?.[0] as RuntimeCapabilityBindingRecord | undefined;
}

function normalizeExecutionOptionNumber(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toForm(metadata?: SystemExecutionMetadata): ExecutionMetadataForm {
  const firstBinding = getFirstCapabilityBinding(metadata) as {
    readonly selectedModelBindingId?: string;
    readonly selectedExecutionOptions?: {
      readonly sampler?: string;
      readonly steps?: number;
      readonly guidanceScale?: number;
    };
  } | undefined;

  return Object.freeze({
    runtimeEnvironment: metadata?.runtime?.environment ?? "",
    runtimeRequirements: formatList(metadata?.runtime?.requirements),
    orchestrationMode: metadata?.orchestration?.mode ?? "",
    orchestrationHints: formatList(metadata?.orchestration?.hints),
    publishVisibility: metadata?.publish?.visibility ?? "",
    publishExportTargets: formatList(metadata?.publish?.exportTargets),
    profileId: metadata?.executionProfile?.profileId ?? "",
    latencyTier: metadata?.executionProfile?.latencyTier ?? "",
    ownerTeam: metadata?.operations?.ownerTeam ?? "",
    supportContact: metadata?.operations?.supportContact ?? "",
    operationsNotes: metadata?.operations?.notes ?? "",
    capabilitySelectedModelBindingId: firstBinding?.selectedModelBindingId ?? "",
    capabilitySampler: firstBinding?.selectedExecutionOptions?.sampler ?? "",
    capabilitySteps: String(firstBinding?.selectedExecutionOptions?.steps ?? ""),
    capabilityGuidanceScale: String(firstBinding?.selectedExecutionOptions?.guidanceScale ?? ""),
  });
}

function buildRuntimeCapabilityBindings(metadata: SystemExecutionMetadata | undefined, form: ExecutionMetadataForm): RuntimeCapabilityBindingEnvelope | undefined {
  const existingEnvelope = metadata?.runtimeCapabilityBindings;
  const existingBindings = [...(existingEnvelope?.bindings ?? [])] as Array<Record<string, unknown>>;
  const hasCapabilityInputs = Boolean(
    form.capabilitySelectedModelBindingId.trim()
    || form.capabilitySampler.trim()
    || form.capabilitySteps.trim()
    || form.capabilityGuidanceScale.trim(),
  );

  if (!hasCapabilityInputs && existingBindings.length === 0) {
    return undefined;
  }

  const first = (existingBindings[0] ?? {
    persistenceVersion: "1.0.0",
    bindingContract: {
      bindingId: "runtime-binding:default",
      systemAssetId: "system:unknown",
      executionProvider: {
        providerId: "provider:unassigned",
        providerKind: "generic-runtime",
        labels: [],
      },
      workflowExecutionProfile: {
        profileId: "profile:default",
        workflowAssetId: "workflow:default",
        executionIntent: "generic",
        requiredCapabilityTags: [],
      },
      modelBindingId: form.capabilitySelectedModelBindingId.trim() || "binding:model:default",
      executionOptionCapability: {
        sampler: { required: false, allowedValues: [] },
        steps: { required: false },
        seed: { required: false, allowDeterministic: true, allowRandom: true },
        guidanceScale: { required: false },
        resolution: { required: false },
        batch: { required: false },
        runtime: { required: false, allowedDevices: ["auto"], allowedPrecisions: ["auto"] },
      },
      executionOptions: {},
      availability: {
        status: "degraded",
        message: "Runtime capability binding requires provider/runtime resolution.",
        missingCapabilities: [],
      },
      contractVersion: "1.0.0",
    },
  }) as Record<string, unknown>;

  const selectedExecutionOptions = {
    ...(typeof first.selectedExecutionOptions === "object" && first.selectedExecutionOptions ? first.selectedExecutionOptions as Record<string, unknown> : {}),
    sampler: form.capabilitySampler.trim() || undefined,
    steps: normalizeExecutionOptionNumber(form.capabilitySteps),
    guidanceScale: normalizeExecutionOptionNumber(form.capabilityGuidanceScale),
  };

  existingBindings[0] = {
    ...first,
    selectedModelBindingId: form.capabilitySelectedModelBindingId.trim() || undefined,
    selectedExecutionOptions,
  };

  return {
    schemaVersion: existingEnvelope?.schemaVersion ?? "1.0.0",
    bindings: existingBindings,
  };
}

function toMetadata(form: ExecutionMetadataForm, sourceMetadata?: SystemExecutionMetadata): SystemExecutionMetadata {
  const runtimeCapabilityBindings = buildRuntimeCapabilityBindings(sourceMetadata, form);
  return Object.freeze({
    runtime: form.runtimeEnvironment || form.runtimeRequirements
      ? Object.freeze({
        environment: form.runtimeEnvironment || undefined,
        requirements: parseList(form.runtimeRequirements),
      })
      : undefined,
    orchestration: form.orchestrationMode || form.orchestrationHints
      ? Object.freeze({
        mode: form.orchestrationMode || undefined,
        hints: parseList(form.orchestrationHints),
      })
      : undefined,
    publish: form.publishVisibility || form.publishExportTargets
      ? Object.freeze({
        visibility: (form.publishVisibility || undefined) as "private" | "team" | "public" | undefined,
        exportTargets: parseList(form.publishExportTargets),
      })
      : undefined,
    executionProfile: form.profileId || form.latencyTier
      ? Object.freeze({
        profileId: form.profileId || undefined,
        latencyTier: (form.latencyTier || undefined) as "standard" | "low-latency" | "batch" | undefined,
      })
      : undefined,
    operations: form.ownerTeam || form.supportContact || form.operationsNotes
      ? Object.freeze({
        ownerTeam: form.ownerTeam || undefined,
        supportContact: form.supportContact || undefined,
        notes: form.operationsNotes || undefined,
      })
      : undefined,
    runtimeCapabilityBindings,
  });
}

export function SystemExecutionMetadataEditor({ context }: { readonly context: StudioShellExtensionContext }): JSX.Element {
  const draft = context.snapshot?.draft;
  const sessionId = context.snapshot?.activeSessionId;
  const spec = draft ? parseSystemSpec(draft.content) : {};
  const [form, setForm] = useState<ExecutionMetadataForm>(toForm(spec.executionMetadata));
  const [metadataJson, setMetadataJson] = useState(JSON.stringify(spec.executionMetadata ?? {}, null, 2));
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonError, setJsonError] = useState<string | undefined>();

  useEffect(() => {
    const nextForm = toForm(spec.executionMetadata);
    setForm(nextForm);
    setMetadataJson(JSON.stringify(spec.executionMetadata ?? {}, null, 2));
    setIsJsonMode(false);
    setJsonError(undefined);
  }, [draft?.draftId, draft?.revision]);

  const updateForm = (nextForm: ExecutionMetadataForm): void => {
    setForm(nextForm);
    setMetadataJson(JSON.stringify(toMetadata(nextForm, spec.executionMetadata), null, 2));
  };

  const resolvePayload = (): SystemExecutionMetadata | undefined => {
    if (!isJsonMode) {
      return toMetadata(form, spec.executionMetadata);
    }

    const parsed = parseJson<SystemExecutionMetadata>(metadataJson);
    if (!parsed.ok) {
      setJsonError("Execution metadata JSON is invalid. Fix JSON before saving.");
      return undefined;
    }
    setJsonError(undefined);
    return parsed.data ?? {};
  };

  const capabilityBindingCount = spec.executionMetadata?.runtimeCapabilityBindings?.bindings?.length ?? 0;

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-execution-metadata-editor">
      <div className="ui-stack ui-stack--2xs">
        <strong>System execution metadata</strong>
        <span className="ui-text-small ui-text-secondary">
          Author bounded runtime, orchestration, publish/export, execution profile, and operational metadata for system assets.
        </span>
      </div>

      <div className="ui-form-json-toggle">
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          onClick={() => {
            if (!isJsonMode) {
              setMetadataJson(JSON.stringify(toMetadata(form, spec.executionMetadata), null, 2));
              setIsJsonMode(true);
              setJsonError(undefined);
              return;
            }

            const parsed = parseJson<SystemExecutionMetadata>(metadataJson);
            if (!parsed.ok) {
              setJsonError("Execution metadata JSON is invalid. Fix JSON before leaving advanced mode.");
              return;
            }

            const nextForm = toForm(parsed.data ?? {});
            setForm(nextForm);
            setMetadataJson(JSON.stringify(parsed.data ?? {}, null, 2));
            setJsonError(undefined);
            setIsJsonMode(false);
          }}
        >
          {isJsonMode ? "Use Form Editor" : "Edit JSON"}
        </button>
      </div>

      {isJsonMode ? (
        <label className="ui-stack ui-stack--2xs">
          <span className="ui-text-small">Execution metadata JSON</span>
          <textarea className="ui-textarea" rows={10} value={metadataJson} onChange={(event) => setMetadataJson(event.target.value)} />
        </label>
      ) : (
        <div className="ui-stack ui-stack--sm">
          <div className="ui-card ui-card--padded ui-stack ui-stack--sm">
            <strong>Runtime</strong>
            <div className="ui-form-grid">
              <label className="ui-field">
                <span className="ui-field__label">Environment</span>
                <input className="ui-input" value={form.runtimeEnvironment} onChange={(event) => updateForm({ ...form, runtimeEnvironment: event.target.value })} />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Requirements (comma-separated)</span>
                <input className="ui-input" value={form.runtimeRequirements} onChange={(event) => updateForm({ ...form, runtimeRequirements: event.target.value })} />
              </label>
            </div>
          </div>

          <div className="ui-card ui-card--padded ui-stack ui-stack--sm">
            <strong>Orchestration</strong>
            <div className="ui-form-grid">
              <label className="ui-field">
                <span className="ui-field__label">Mode</span>
                <input className="ui-input" value={form.orchestrationMode} onChange={(event) => updateForm({ ...form, orchestrationMode: event.target.value })} />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Hints (comma-separated)</span>
                <input className="ui-input" value={form.orchestrationHints} onChange={(event) => updateForm({ ...form, orchestrationHints: event.target.value })} />
              </label>
            </div>
          </div>

          <div className="ui-card ui-card--padded ui-stack ui-stack--sm">
            <strong>Publish</strong>
            <div className="ui-form-grid">
              <label className="ui-field">
                <span className="ui-field__label">Visibility</span>
                <input className="ui-input" value={form.publishVisibility} onChange={(event) => updateForm({ ...form, publishVisibility: event.target.value })} />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Export targets (comma-separated)</span>
                <input className="ui-input" value={form.publishExportTargets} onChange={(event) => updateForm({ ...form, publishExportTargets: event.target.value })} />
              </label>
            </div>
          </div>

          <div className="ui-card ui-card--padded ui-stack ui-stack--sm">
            <strong>Execution profile</strong>
            <div className="ui-form-grid">
              <label className="ui-field">
                <span className="ui-field__label">Profile ID</span>
                <input className="ui-input" value={form.profileId} onChange={(event) => updateForm({ ...form, profileId: event.target.value })} />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Latency tier</span>
                <input className="ui-input" value={form.latencyTier} onChange={(event) => updateForm({ ...form, latencyTier: event.target.value })} />
              </label>
            </div>
          </div>

          <div className="ui-card ui-card--padded ui-stack ui-stack--sm">
            <strong>Runtime capability binding (bounded)</strong>
            <span className="ui-text-small ui-text-secondary">
              Persist and inspect the selected model/checkpoint binding plus bounded runtime options (provider payloads are intentionally excluded).
            </span>
            <div className="ui-form-grid">
              <label className="ui-field">
                <span className="ui-field__label">Model binding ID</span>
                <input
                  className="ui-input"
                  value={form.capabilitySelectedModelBindingId}
                  onChange={(event) => updateForm({ ...form, capabilitySelectedModelBindingId: event.target.value })}
                  placeholder="binding:model:sdxl-default"
                />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Sampler</span>
                <input
                  className="ui-input"
                  value={form.capabilitySampler}
                  onChange={(event) => updateForm({ ...form, capabilitySampler: event.target.value })}
                  placeholder="euler"
                />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Steps</span>
                <input
                  className="ui-input"
                  value={form.capabilitySteps}
                  onChange={(event) => updateForm({ ...form, capabilitySteps: event.target.value })}
                  placeholder="30"
                />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Guidance scale</span>
                <input
                  className="ui-input"
                  value={form.capabilityGuidanceScale}
                  onChange={(event) => updateForm({ ...form, capabilityGuidanceScale: event.target.value })}
                  placeholder="7"
                />
              </label>
            </div>
            <span className="ui-text-small ui-text-secondary">
              Persisted bindings: {capabilityBindingCount}
            </span>
          </div>

          <div className="ui-card ui-card--padded ui-stack ui-stack--sm">
            <strong>Operations</strong>
            <div className="ui-form-grid">
              <label className="ui-field">
                <span className="ui-field__label">Owner team</span>
                <input className="ui-input" value={form.ownerTeam} onChange={(event) => updateForm({ ...form, ownerTeam: event.target.value })} />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Support contact</span>
                <input className="ui-input" value={form.supportContact} onChange={(event) => updateForm({ ...form, supportContact: event.target.value })} />
              </label>
            </div>
            <label className="ui-field">
              <span className="ui-field__label">Notes</span>
              <textarea className="ui-textarea" rows={4} value={form.operationsNotes} onChange={(event) => updateForm({ ...form, operationsNotes: event.target.value })} />
            </label>
          </div>
        </div>
      )}

      {jsonError ? <p className="ui-text-muted">{jsonError}</p> : null}

      <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row" }}>
        <button
          className="ui-button"
          disabled={!draft || !sessionId || context.isBusy}
          onClick={() => {
            if (!draft || !sessionId) {
              return;
            }
            const payload = resolvePayload();
            if (!payload) {
              return;
            }
            void context.operations.updateSystemExecutionMetadata?.({
              studioId: context.studioId,
              sessionId,
              draftId: draft.draftId,
              executionMetadata: payload,
            });
          }}
        >
          Save Execution Metadata
        </button>
      </div>
    </div>
  );
}
