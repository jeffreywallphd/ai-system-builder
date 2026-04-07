import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  RuntimeSdkError,
  RuntimeSdkExecutionContext,
  RuntimeSdkResponse,
  RuntimeSdkStartExecutionResponse,
} from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import type { SurfaceResponsiveProfile } from "../responsive";
import { SurfaceResponsiveFormLayout } from "../components/shell";

export type ApprovedRunParameterValueKind = "integer" | "number";

export interface ApprovedRunParameterDefinition {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly valueKind: ApprovedRunParameterValueKind;
  readonly required?: boolean;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly defaultValue?: number;
}

export interface ApprovedRunParameterFieldState {
  readonly rawValue: string;
}

export interface OperationalApprovedRunLaunchDraft {
  readonly systemId: string;
  readonly versionId: string;
  readonly trigger: RuntimeSdkExecutionContext["trigger"];
  readonly inputPayloadRaw: string;
  readonly parameterFieldState: Readonly<Record<string, ApprovedRunParameterFieldState>>;
}

export interface OperationalApprovedRunLaunchValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface OperationalApprovedRunLaunchValidatedInput {
  readonly systemId: string;
  readonly versionId: string;
  readonly trigger: RuntimeSdkExecutionContext["trigger"];
  readonly inputPayload?: unknown;
  readonly approvedParameters?: Readonly<Record<string, number>>;
}

type OperationalApprovedRunLaunchValidationResult =
  | {
    readonly ok: true;
    readonly value: OperationalApprovedRunLaunchValidatedInput;
  }
  | {
    readonly ok: false;
    readonly issues: ReadonlyArray<OperationalApprovedRunLaunchValidationIssue>;
  };

export type OperationalRunLaunchSubmissionState =
  | {
    readonly kind: "idle";
  }
  | {
    readonly kind: "submitting";
    readonly title: string;
    readonly message: string;
  }
  | {
    readonly kind: "accepted";
    readonly title: string;
    readonly message: string;
    readonly executionId: string;
  }
  | {
    readonly kind: "validation-error" | "denied" | "failed";
    readonly title: string;
    readonly message: string;
    readonly details: ReadonlyArray<string>;
  };

export interface OperationalApprovedRunLaunchPanelProps {
  readonly responsiveProfile: SurfaceResponsiveProfile;
  readonly surface: "desktop" | "thin-client";
  readonly onSubmit: (input: OperationalApprovedRunLaunchValidatedInput) => Promise<RuntimeSdkResponse<RuntimeSdkStartExecutionResponse>>;
  readonly onRunAccepted?: (data: RuntimeSdkStartExecutionResponse) => void;
  readonly openSystemRunnerPath: string;
  readonly parameterDefinitions?: ReadonlyArray<ApprovedRunParameterDefinition>;
  readonly initialSystemId?: string;
  readonly initialVersionId?: string;
  readonly initialTrigger?: RuntimeSdkExecutionContext["trigger"];
  readonly initialInputPayloadRaw?: string;
}

export const DEFAULT_APPROVED_RUN_PARAMETER_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: "maxRuntimeSeconds",
    label: "Max runtime seconds",
    description: "Upper bound for runtime duration enforced by authoritative execution policy.",
    valueKind: "integer",
    required: true,
    minimum: 30,
    maximum: 3600,
    defaultValue: 120,
  } satisfies ApprovedRunParameterDefinition),
  Object.freeze({
    key: "maxOutputAssets",
    label: "Max output assets",
    description: "Maximum number of output assets this approved operational run can persist.",
    valueKind: "integer",
    required: true,
    minimum: 1,
    maximum: 25,
    defaultValue: 5,
  } satisfies ApprovedRunParameterDefinition),
]) satisfies ReadonlyArray<ApprovedRunParameterDefinition>;

export function OperationalApprovedRunLaunchPanel({
  responsiveProfile,
  surface,
  onSubmit,
  onRunAccepted,
  openSystemRunnerPath,
  parameterDefinitions = DEFAULT_APPROVED_RUN_PARAMETER_DEFINITIONS,
  initialSystemId = "",
  initialVersionId = "",
  initialTrigger = "manual",
  initialInputPayloadRaw = "{\n  \"message\": \"Hello from operational dashboard\"\n}",
}: OperationalApprovedRunLaunchPanelProps): JSX.Element {
  const [systemId, setSystemId] = useState(initialSystemId);
  const [versionId, setVersionId] = useState(initialVersionId);
  const [trigger, setTrigger] = useState<RuntimeSdkExecutionContext["trigger"]>(initialTrigger);
  const [inputPayloadRaw, setInputPayloadRaw] = useState(initialInputPayloadRaw);
  const [parameterFieldState, setParameterFieldState] = useState(() => createInitialParameterFieldState(parameterDefinitions));
  const [submissionState, setSubmissionState] = useState<OperationalRunLaunchSubmissionState>(Object.freeze({ kind: "idle" }));

  const parameterIssueMap = useMemo(() => toParameterIssueMap(submissionState), [submissionState]);
  const formIssueSummary = useMemo(() => {
    if (submissionState.kind !== "validation-error") {
      return Object.freeze([]);
    }
    return submissionState.details;
  }, [submissionState]);

  const submitLaunchRequest = async (): Promise<void> => {
    const validation = validateOperationalApprovedRunLaunchDraft({
      systemId,
      versionId,
      trigger,
      inputPayloadRaw,
      parameterFieldState,
    }, parameterDefinitions);
    if (!validation.ok) {
      setSubmissionState(Object.freeze({
        kind: "validation-error",
        title: "Launch validation failed",
        message: "Fix required fields before submitting this approved run.",
        details: Object.freeze(validation.issues.map((issue) => issue.message)),
      }));
      return;
    }

    setSubmissionState(Object.freeze({
      kind: "submitting",
      title: "Submitting approved run",
      message: "Sending launch request to authoritative runtime APIs.",
    }));
    const response = await onSubmit(validation.value);
    const mappedState = mapRuntimeStartResponseToSubmissionState(response);
    setSubmissionState(mappedState);
    if (response.ok && response.data) {
      onRunAccepted?.(response.data);
    }
  };

  return (
    <section className="ui-card ui-operational-approved-run-launch" data-testid="operational-approved-run-launch">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Approved run initiation</h2>
        <p className="ui-card__subtitle">
          {surface === "desktop"
            ? "Launch approved runtime executions with bounded parameter controls and immediate API validation feedback."
            : "Thin-client launch flow for approved runs with bounded controls and immediate API feedback."}
        </p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <SurfaceResponsiveFormLayout responsiveProfile={responsiveProfile}>
          <div className="ui-responsive-form__grid">
            {surface === "thin-client" ? (
              <p className="ui-text-small ui-text-secondary ui-operational-approved-run-launch__step">
                Step 1: Provide approved run identifiers and bounded parameters.
              </p>
            ) : null}
            <label className="ui-field">
              <span className="ui-field__label">System id</span>
              <input
                className="ui-input"
                value={systemId}
                onChange={(event) => setSystemId(event.target.value)}
                aria-invalid={parameterIssueMap.has("systemId")}
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Version id</span>
              <input
                className="ui-input"
                value={versionId}
                onChange={(event) => setVersionId(event.target.value)}
                aria-invalid={parameterIssueMap.has("versionId")}
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Trigger</span>
              <select
                className="ui-select"
                value={trigger}
                onChange={(event) => {
                  const next = event.target.value;
                  setTrigger(next === "api" ? "api" : "manual");
                }}
              >
                <option value="manual">manual</option>
                <option value="api">api</option>
              </select>
            </label>
            <div className="ui-operational-approved-run-launch__section">
              <h3 className="ui-text-small">Allowed parameters</h3>
              <div className="ui-stack ui-stack--xs">
                {parameterDefinitions.map((definition) => {
                  const fieldState = parameterFieldState[definition.key];
                  const issue = parameterIssueMap.get(`approvedParameters.${definition.key}`);
                  return (
                    <label className="ui-field" key={definition.key}>
                      <span className="ui-field__label">{definition.label}</span>
                      {definition.description ? <span className="ui-text-small ui-text-secondary">{definition.description}</span> : null}
                      <input
                        className="ui-input"
                        inputMode="numeric"
                        value={fieldState?.rawValue ?? ""}
                        onChange={(event) => setParameterFieldState((current) => Object.freeze({
                          ...current,
                          [definition.key]: Object.freeze({ rawValue: event.target.value }),
                        }))}
                        aria-invalid={Boolean(issue)}
                      />
                      {issue ? <span className="ui-text-small" role="alert">{issue}</span> : null}
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="ui-field ui-operational-approved-run-launch__payload-field">
              <span className="ui-field__label">Input payload (JSON)</span>
              <textarea
                className="ui-input"
                rows={5}
                value={inputPayloadRaw}
                onChange={(event) => setInputPayloadRaw(event.target.value)}
                aria-invalid={parameterIssueMap.has("inputPayload")}
              />
            </label>
          </div>
        </SurfaceResponsiveFormLayout>
        {surface === "thin-client" ? (
          <p className="ui-text-small ui-text-secondary ui-operational-approved-run-launch__step">
            Step 2: Launch the approved run and review validation feedback.
          </p>
        ) : null}
        <div className="ui-page__actions ui-operational-approved-run-launch__actions">
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--small"
            onClick={() => void submitLaunchRequest()}
            disabled={submissionState.kind === "submitting"}
          >
            {submissionState.kind === "submitting" ? "Submitting..." : "Launch approved run"}
          </button>
          <Link className="ui-button ui-button--ghost ui-button--small" to={openSystemRunnerPath}>Open system runner</Link>
        </div>
        <OperationalRunLaunchSubmissionPanel submissionState={submissionState} validationDetails={formIssueSummary} />
      </div>
    </section>
  );
}

interface OperationalRunLaunchSubmissionPanelProps {
  readonly submissionState: OperationalRunLaunchSubmissionState;
  readonly validationDetails: ReadonlyArray<string>;
}

function OperationalRunLaunchSubmissionPanel({
  submissionState,
  validationDetails,
}: OperationalRunLaunchSubmissionPanelProps): JSX.Element | null {
  if (submissionState.kind === "idle") {
    return null;
  }

  const tone = submissionState.kind === "accepted"
    ? "success"
    : submissionState.kind === "submitting"
      ? "neutral"
      : submissionState.kind === "denied"
        ? "warning"
        : "danger";

  return (
    <article className={`ui-operational-dashboard__alert ui-operational-dashboard__alert--${tone}`} aria-live="polite">
      <div className="ui-stack ui-stack--2xs">
        <strong>{submissionState.title}</strong>
        <span className="ui-text-small">{submissionState.message}</span>
        {submissionState.kind === "accepted" ? (
          <span className="ui-text-small">Execution id: {submissionState.executionId}</span>
        ) : null}
      </div>
      {validationDetails.length > 0 ? (
        <ul className="ui-text-small ui-operational-approved-run-launch__validation-list">
          {validationDetails.map((entry, index) => (
            <li key={`${entry}:${index}`}>{entry}</li>
          ))}
        </ul>
      ) : null}
      {(submissionState.kind === "denied" || submissionState.kind === "failed") && submissionState.details.length > 0 ? (
        <ul className="ui-text-small ui-operational-approved-run-launch__validation-list">
          {submissionState.details.map((entry, index) => (
            <li key={`${entry}:${index}`}>{entry}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function toParameterIssueMap(submissionState: OperationalRunLaunchSubmissionState): ReadonlyMap<string, string> {
  if (submissionState.kind !== "validation-error") {
    return new Map();
  }
  const map = new Map<string, string>();
  for (const detail of submissionState.details) {
    if (detail.includes("System id")) {
      map.set("systemId", detail);
    } else if (detail.includes("Version id")) {
      map.set("versionId", detail);
    } else if (detail.includes("Input payload")) {
      map.set("inputPayload", detail);
    } else if (detail.includes("Allowed parameter")) {
      const parameterName = detail.split("\"")[1];
      if (parameterName) {
        map.set(`approvedParameters.${parameterName}`, detail);
      }
    }
  }
  return map;
}

function createInitialParameterFieldState(
  definitions: ReadonlyArray<ApprovedRunParameterDefinition>,
): Readonly<Record<string, ApprovedRunParameterFieldState>> {
  const entries = definitions.map((definition) => ([
    definition.key,
    Object.freeze({
      rawValue: definition.defaultValue !== undefined ? definition.defaultValue.toString(10) : "",
    } satisfies ApprovedRunParameterFieldState),
  ] as const));
  return Object.freeze(Object.fromEntries(entries));
}

export function validateOperationalApprovedRunLaunchDraft(
  draft: OperationalApprovedRunLaunchDraft,
  definitions: ReadonlyArray<ApprovedRunParameterDefinition>,
): OperationalApprovedRunLaunchValidationResult {
  const issues: Array<OperationalApprovedRunLaunchValidationIssue> = [];
  const systemId = draft.systemId.trim();
  const versionId = draft.versionId.trim();
  if (!systemId) {
    issues.push(Object.freeze({ path: "systemId", message: "System id is required." }));
  }
  if (!versionId) {
    issues.push(Object.freeze({ path: "versionId", message: "Version id is required." }));
  }

  const inputPayloadResult = parseOptionalJson(draft.inputPayloadRaw);
  if (!inputPayloadResult.ok) {
    issues.push(Object.freeze({ path: "inputPayload", message: inputPayloadResult.error }));
  }

  const approvedParametersResult = parseApprovedParameters(draft.parameterFieldState, definitions);
  if (!approvedParametersResult.ok) {
    issues.push(...approvedParametersResult.issues);
  }

  if (issues.length > 0) {
    return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  }

  return Object.freeze({
    ok: true,
    value: Object.freeze({
      systemId,
      versionId,
      trigger: draft.trigger,
      inputPayload: inputPayloadResult.ok ? inputPayloadResult.value : undefined,
      approvedParameters: approvedParametersResult.ok ? approvedParametersResult.value : undefined,
    }),
  });
}

function parseOptionalJson(raw: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string } {
  const normalized = raw.trim();
  if (!normalized) {
    return { ok: true, value: undefined };
  }
  try {
    return { ok: true, value: JSON.parse(normalized) };
  } catch {
    return { ok: false, error: "Input payload must be valid JSON." };
  }
}

function parseApprovedParameters(
  parameterFieldState: Readonly<Record<string, ApprovedRunParameterFieldState>>,
  definitions: ReadonlyArray<ApprovedRunParameterDefinition>,
): { readonly ok: true; readonly value: Readonly<Record<string, number>> | undefined } | { readonly ok: false; readonly issues: ReadonlyArray<OperationalApprovedRunLaunchValidationIssue> } {
  const issues: Array<OperationalApprovedRunLaunchValidationIssue> = [];
  const approved: Record<string, number> = {};
  for (const definition of definitions) {
    const raw = parameterFieldState[definition.key]?.rawValue?.trim() ?? "";
    if (!raw) {
      if (definition.required) {
        issues.push(Object.freeze({
          path: `approvedParameters.${definition.key}`,
          message: `Allowed parameter "${definition.key}" is required.`,
        }));
      }
      continue;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      issues.push(Object.freeze({
        path: `approvedParameters.${definition.key}`,
        message: `Allowed parameter "${definition.key}" must be numeric.`,
      }));
      continue;
    }
    if (definition.valueKind === "integer" && Math.floor(parsed) !== parsed) {
      issues.push(Object.freeze({
        path: `approvedParameters.${definition.key}`,
        message: `Allowed parameter "${definition.key}" must be an integer.`,
      }));
      continue;
    }
    if (definition.minimum !== undefined && parsed < definition.minimum) {
      issues.push(Object.freeze({
        path: `approvedParameters.${definition.key}`,
        message: `Allowed parameter "${definition.key}" must be at least ${definition.minimum}.`,
      }));
      continue;
    }
    if (definition.maximum !== undefined && parsed > definition.maximum) {
      issues.push(Object.freeze({
        path: `approvedParameters.${definition.key}`,
        message: `Allowed parameter "${definition.key}" must be at most ${definition.maximum}.`,
      }));
      continue;
    }
    approved[definition.key] = parsed;
  }

  if (issues.length > 0) {
    return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  }
  return Object.freeze({
    ok: true,
    value: Object.keys(approved).length > 0 ? Object.freeze({ ...approved }) : undefined,
  });
}

export function mapRuntimeStartResponseToSubmissionState(
  response: RuntimeSdkResponse<RuntimeSdkStartExecutionResponse>,
): OperationalRunLaunchSubmissionState {
  if (response.ok && response.data) {
    return Object.freeze({
      kind: "accepted",
      title: "Run accepted",
      message: `Execution ${response.data.executionId} is ${response.data.acceptedState ?? response.data.status}.`,
      executionId: response.data.executionId,
    });
  }
  return mapRuntimeErrorToSubmissionState(response.error);
}

function mapRuntimeErrorToSubmissionState(error: RuntimeSdkError | undefined): OperationalRunLaunchSubmissionState {
  if (error?.code === "invalid-request") {
    const details = (error.validationErrors ?? [])
      .map((entry) => `${entry.path}: ${entry.message}`);
    return Object.freeze({
      kind: "validation-error",
      title: "Run launch request is invalid",
      message: error.message || "Fix request validation issues and submit again.",
      details: Object.freeze(details.length > 0 ? details : [error.message || "Run launch validation failed."]),
    });
  }
  if (error?.code === "forbidden" || error?.code === "unauthorized") {
    return Object.freeze({
      kind: "denied",
      title: "Run launch denied",
      message: error.message || "The current session is not allowed to launch this run.",
      details: Object.freeze([`Permission status: ${error.code}.`]),
    });
  }
  return Object.freeze({
    kind: "failed",
    title: "Run launch failed",
    message: error?.message || "Authoritative runtime launch failed.",
    details: Object.freeze([`Error code: ${error?.code ?? "internal"}.`]),
  });
}
