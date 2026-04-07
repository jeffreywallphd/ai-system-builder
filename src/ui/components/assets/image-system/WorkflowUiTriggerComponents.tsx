import type { JSX, ReactNode } from "react";
import type { ImageWorkflowUiTriggerBindingConfiguration } from "@application/contracts/ImageWorkflowUiTriggerBindingConfiguration";
import type { DispatchWorkflowFromUiEventCommand, WorkflowUiEventRuntimeDispatcher } from "@application/workflow-studio/WorkflowUiEventRuntimeDispatcher";
import { createUiTriggerEvent, type UiTriggerEvent, type UiTriggerEventContextRef, type UiTriggerEventKind } from "@application/workflow-studio/UiTriggerEventContract";

export interface WorkflowUiTriggerDispatchAdapter {
  readonly dispatch: (event: UiTriggerEvent) => Promise<void>;
}

export interface WorkflowUiTriggerDispatchConfiguration {
  readonly content: string;
  readonly bindings?: ImageWorkflowUiTriggerBindingConfiguration;
  readonly request?: DispatchWorkflowFromUiEventCommand["request"];
  readonly context?: DispatchWorkflowFromUiEventCommand["context"];
  readonly inputs?: DispatchWorkflowFromUiEventCommand["inputs"];
  readonly manualDecisionsByStepId?: DispatchWorkflowFromUiEventCommand["manualDecisionsByStepId"];
  readonly maxLoopIterations?: number;
  readonly feedback?: DispatchWorkflowFromUiEventCommand["feedback"];
}

export function createWorkflowUiTriggerDispatchAdapter(input: {
  readonly dispatcher: WorkflowUiEventRuntimeDispatcher;
  readonly configuration: WorkflowUiTriggerDispatchConfiguration;
}): WorkflowUiTriggerDispatchAdapter {
  return Object.freeze({
    dispatch: async (event) => {
      await input.dispatcher.dispatch({
        ...input.configuration,
        event,
      });
    },
  });
}

export interface WorkflowUiTriggerSourceConfig {
  readonly studio: "system-studio" | "workflow-studio" | "dataset-studio" | "unknown";
  readonly componentId: string;
  readonly componentType?: string;
  readonly actionId?: string;
}

export interface WorkflowUiTriggerConfig {
  readonly eventName: string;
  readonly kind: UiTriggerEventKind;
  readonly source: WorkflowUiTriggerSourceConfig;
  readonly context?: UiTriggerEventContextRef;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createWorkflowUiTriggerEvent(config: WorkflowUiTriggerConfig): UiTriggerEvent {
  return createUiTriggerEvent({
    kind: config.kind,
    name: config.eventName,
    source: config.source,
    context: config.context,
    payload: config.payload,
    metadata: config.metadata,
  });
}

export interface WorkflowTriggerButtonProps {
  readonly trigger: WorkflowUiTriggerConfig;
  readonly dispatch?: WorkflowUiTriggerDispatchAdapter;
  readonly onTriggered?: (event: UiTriggerEvent) => void;
  readonly label: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly type?: "button" | "submit";
}

export function WorkflowTriggerButton({
  trigger,
  dispatch,
  onTriggered,
  label,
  className = "ui-button ui-button--secondary ui-button--sm",
  disabled = false,
  type = "button",
}: WorkflowTriggerButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      onClick={() => {
        const event = createWorkflowUiTriggerEvent(trigger);
        onTriggered?.(event);
        void dispatch?.dispatch(event);
      }}
    >
      {label}
    </button>
  );
}

export interface WorkflowAwareSubmitWrapperProps {
  readonly trigger: Omit<WorkflowUiTriggerConfig, "kind">;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly dispatch?: WorkflowUiTriggerDispatchAdapter;
  readonly onTriggered?: (event: UiTriggerEvent) => void;
  readonly children: ReactNode;
  readonly className?: string;
}

export function WorkflowAwareSubmitWrapper({
  trigger,
  payload,
  dispatch,
  onTriggered,
  children,
  className = "ui-form-grid",
}: WorkflowAwareSubmitWrapperProps): JSX.Element {
  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const mapped = createWorkflowUiTriggerEvent({
          ...trigger,
          kind: "submit",
          payload,
        });
        onTriggered?.(mapped);
        void dispatch?.dispatch(mapped);
      }}
    >
      {children}
    </form>
  );
}

export interface ImageSelectionTriggerSurfaceProps {
  readonly trigger: Omit<WorkflowUiTriggerConfig, "kind">;
  readonly imageId: string;
  readonly selectedIds?: ReadonlyArray<string>;
  readonly dispatch?: WorkflowUiTriggerDispatchAdapter;
  readonly onTriggered?: (event: UiTriggerEvent) => void;
  readonly className?: string;
  readonly children: ReactNode;
}

export function ImageSelectionTriggerSurface({
  trigger,
  imageId,
  selectedIds,
  dispatch,
  onTriggered,
  className = "ui-image-output-gallery__button",
  children,
}: ImageSelectionTriggerSurfaceProps): JSX.Element {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const event = createWorkflowUiTriggerEvent({
          ...trigger,
          kind: "selection",
          payload: {
            imageId,
            selectedIds: selectedIds ?? [imageId],
            selectedImage: {
              imageId,
              assetRef: {
                assetId: imageId,
              },
            },
          },
        });
        onTriggered?.(event);
        void dispatch?.dispatch(event);
      }}
    >
      {children}
    </button>
  );
}

