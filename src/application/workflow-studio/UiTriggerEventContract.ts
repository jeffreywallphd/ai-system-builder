import { WorkflowExecutionTriggerSourceKinds, type WorkflowExecutionTriggerSourceKind } from "./WorkflowExecutionAlignmentContracts";

export const UiTriggerEventKinds = Object.freeze({
  click: "click",
  submit: "submit",
  selection: "selection",
});

export type UiTriggerEventKind = typeof UiTriggerEventKinds[keyof typeof UiTriggerEventKinds];

export interface UiTriggerEventSourceRef {
  readonly studio: "system-studio" | "workflow-studio" | "dataset-studio" | "unknown";
  readonly componentId: string;
  readonly componentType?: string;
  readonly actionId?: string;
}

export interface UiTriggerEventContextRef {
  readonly workflowAssetId?: string;
  readonly workflowRunId?: string;
  readonly systemAssetId?: string;
  readonly systemVersionId?: string;
  readonly datasetAssetId?: string;
  readonly datasetVersionId?: string;
  readonly selectorSessionId?: string;
  readonly references?: Readonly<Record<string, string>>;
}

export interface UiTriggerEvent<TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly kind: UiTriggerEventKind;
  readonly name: string;
  readonly source: UiTriggerEventSourceRef;
  readonly payload: TPayload;
  readonly context?: UiTriggerEventContextRef;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UiTriggerEventValidationIssue {
  readonly code:
    | "ui-trigger-kind-invalid"
    | "ui-trigger-name-required"
    | "ui-trigger-source-component-required"
    | "ui-trigger-source-studio-invalid"
    | "ui-trigger-occurred-at-invalid"
    | "ui-trigger-payload-invalid"
    | "ui-trigger-payload-key-reserved";
  readonly message: string;
}

export function mapUiTriggerKindToWorkflowSourceKind(kind: UiTriggerEventKind): WorkflowExecutionTriggerSourceKind {
  if (kind === UiTriggerEventKinds.selection) {
    return WorkflowExecutionTriggerSourceKinds.stateData;
  }
  return WorkflowExecutionTriggerSourceKinds.manualUser;
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasReservedPayloadKeys(payload: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(payload).some((key) => key === "nativeEvent" || key === "target" || key === "currentTarget");
}

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSource(input: UiTriggerEventSourceRef): UiTriggerEventSourceRef {
  const studio = input.studio === "system-studio"
    || input.studio === "workflow-studio"
    || input.studio === "dataset-studio"
    || input.studio === "unknown"
    ? input.studio
    : "unknown";

  return Object.freeze({
    studio,
    componentId: readTrimmedString(input.componentId) ?? "unknown-component",
    componentType: readTrimmedString(input.componentType),
    actionId: readTrimmedString(input.actionId),
  });
}

export function validateUiTriggerEvent(event: UiTriggerEvent): ReadonlyArray<UiTriggerEventValidationIssue> {
  const issues: UiTriggerEventValidationIssue[] = [];
  if (event.kind !== UiTriggerEventKinds.click && event.kind !== UiTriggerEventKinds.submit && event.kind !== UiTriggerEventKinds.selection) {
    issues.push({
      code: "ui-trigger-kind-invalid",
      message: `UI trigger kind '${String(event.kind)}' is not supported.`,
    });
  }
  if (!readTrimmedString(event.name)) {
    issues.push({
      code: "ui-trigger-name-required",
      message: "UI trigger event name is required.",
    });
  }
  if (!readTrimmedString(event.source.componentId)) {
    issues.push({
      code: "ui-trigger-source-component-required",
      message: "UI trigger event source component id is required.",
    });
  }
  if (
    event.source.studio !== "system-studio"
    && event.source.studio !== "workflow-studio"
    && event.source.studio !== "dataset-studio"
    && event.source.studio !== "unknown"
  ) {
    issues.push({
      code: "ui-trigger-source-studio-invalid",
      message: `UI trigger event source studio '${String(event.source.studio)}' is not supported.`,
    });
  }
  if (Number.isNaN(Date.parse(event.occurredAt))) {
    issues.push({
      code: "ui-trigger-occurred-at-invalid",
      message: "UI trigger event occurredAt must be an ISO-compatible timestamp.",
    });
  }
  if (!isPlainRecord(event.payload)) {
    issues.push({
      code: "ui-trigger-payload-invalid",
      message: "UI trigger payload must be a plain record.",
    });
  } else if (hasReservedPayloadKeys(event.payload)) {
    issues.push({
      code: "ui-trigger-payload-key-reserved",
      message: "UI trigger payload cannot include framework-reserved event keys.",
    });
  }

  return Object.freeze(issues.map((issue) => Object.freeze(issue)));
}

export function createUiTriggerEvent(input: {
  readonly eventId?: string;
  readonly occurredAt?: string;
  readonly kind: UiTriggerEventKind;
  readonly name: string;
  readonly source: UiTriggerEventSourceRef;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly context?: UiTriggerEventContextRef;
  readonly metadata?: Readonly<Record<string, unknown>>;
}): UiTriggerEvent {
  return Object.freeze({
    eventId: readTrimmedString(input.eventId) ?? `ui-trigger:${input.kind}:${Date.now().toString(36)}`,
    occurredAt: readTrimmedString(input.occurredAt) ?? new Date().toISOString(),
    kind: input.kind,
    name: readTrimmedString(input.name) ?? "ui.unknown",
    source: normalizeSource(input.source),
    payload: Object.freeze({ ...(input.payload ?? {}) }),
    context: input.context
      ? Object.freeze({
        ...input.context,
        references: input.context.references ? Object.freeze({ ...input.context.references }) : undefined,
      })
      : undefined,
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
  });
}
