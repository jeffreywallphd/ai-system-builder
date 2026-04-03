import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import type {
  CanvasExperienceAssetDefinition,
  CanvasSurfaceEditingEvent,
  CanvasSurfaceEditingModel,
  CanvasSurfaceFocusedTarget,
  CanvasSurfaceGraphSummary,
  CanvasSurfaceIdentity,
  CanvasSurfaceLayoutNodeModel,
  CanvasSurfacePaletteModel,
  CanvasSurfaceSnapModel,
  CanvasSurfaceToolbarActionModel,
  CanvasSurfaceViewportModel,
} from "../../../studio-shell/experience-assets/ConfigurableCanvasSurfaceContracts";
import type { ExperienceIssueSummary } from "../../../studio-shell/experience-assets/ExperiencePresentationVocabulary";

interface CanvasDrawerState {
  readonly label: string;
  readonly isEnabled: boolean;
  readonly isOpen: boolean;
  readonly onClose?: () => void;
}

interface ConfigurableCanvasSurfaceDirectProps {
  readonly identity: CanvasSurfaceIdentity;
  readonly graphSummary: CanvasSurfaceGraphSummary;
  readonly focusedTarget?: CanvasSurfaceFocusedTarget;
  readonly palette?: CanvasSurfacePaletteModel;
  readonly issues?: ReadonlyArray<ExperienceIssueSummary>;
  readonly toolbarActions?: ReadonlyArray<CanvasSurfaceToolbarActionModel>;
  readonly editingModel?: CanvasSurfaceEditingModel;
  readonly onEditingEvent?: (event: CanvasSurfaceEditingEvent) => void;
  readonly renderGraphInteractionShell?: (focusedTarget?: CanvasSurfaceFocusedTarget) => JSX.Element;
  readonly renderPaletteRegion?: () => JSX.Element | null;
  readonly renderInspectorRegion?: (focusedTarget?: CanvasSurfaceFocusedTarget) => JSX.Element | null;
  readonly renderSupplementaryPanels?: () => JSX.Element | null;
  readonly interactionMessage?: string;
  readonly isEmpty?: boolean;
  readonly renderEmptyState?: () => JSX.Element;
  readonly leftDrawer?: CanvasDrawerState;
  readonly rightDrawer?: CanvasDrawerState;
}

interface ConfigurableCanvasSurfaceDefinitionProps<TContext> {
  readonly definition: CanvasExperienceAssetDefinition<TContext>;
  readonly definitionContext: TContext;
  readonly leftDrawer?: CanvasDrawerState;
  readonly rightDrawer?: CanvasDrawerState;
}

interface ResolvedCanvasModel {
  readonly identity: CanvasSurfaceIdentity;
  readonly graphSummary: CanvasSurfaceGraphSummary;
  readonly focusedTarget?: CanvasSurfaceFocusedTarget;
  readonly palette?: CanvasSurfacePaletteModel;
  readonly issues: ReadonlyArray<ExperienceIssueSummary>;
  readonly toolbarActions: ReadonlyArray<CanvasSurfaceToolbarActionModel>;
  readonly editingModel?: CanvasSurfaceEditingModel;
  readonly onEditingEvent?: (event: CanvasSurfaceEditingEvent) => void;
  readonly renderGraphInteractionShell?: (focusedTarget?: CanvasSurfaceFocusedTarget) => JSX.Element;
  readonly renderPaletteRegion?: () => JSX.Element | null;
  readonly renderInspectorRegion?: (focusedTarget?: CanvasSurfaceFocusedTarget) => JSX.Element | null;
  readonly renderSupplementaryPanels?: () => JSX.Element | null;
  readonly interactionMessage?: string;
  readonly isEmpty: boolean;
  readonly renderEmptyState?: () => JSX.Element | null;
  readonly leftDrawer?: CanvasDrawerState;
  readonly rightDrawer?: CanvasDrawerState;
}

export type ConfigurableCanvasSurfaceProps<TContext = never> =
  | ConfigurableCanvasSurfaceDirectProps
  | ConfigurableCanvasSurfaceDefinitionProps<TContext>;

function isDefinitionProps<TContext>(
  props: ConfigurableCanvasSurfaceProps<TContext>,
): props is ConfigurableCanvasSurfaceDefinitionProps<TContext> {
  return "definition" in props;
}

function clamp(value: number, min: number): number {
  return Number.isFinite(value) ? Math.max(min, value) : min;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function clampToBounds(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function resolveSnapStep(divisions: number): number {
  const safeDivisions = Number.isFinite(divisions) && divisions > 0 ? Math.floor(divisions) : 1;
  return 1 / safeDivisions;
}

function snapNormalized(value: number, divisions: number): number {
  const step = resolveSnapStep(divisions);
  return clamp01(Math.round(value / step) * step);
}

function normalizeSnappedFrame(input: {
  readonly frame: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly divisions: { readonly x: number; readonly y: number };
}): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const minWidth = resolveSnapStep(input.divisions.x);
  const minHeight = resolveSnapStep(input.divisions.y);
  const left = snapNormalized(input.frame.x, input.divisions.x);
  const top = snapNormalized(input.frame.y, input.divisions.y);
  const right = snapNormalized(input.frame.x + input.frame.width, input.divisions.x);
  const bottom = snapNormalized(input.frame.y + input.frame.height, input.divisions.y);
  const boundedRight = Math.max(left + minWidth, Math.min(1, right));
  const boundedBottom = Math.max(top + minHeight, Math.min(1, bottom));
  const width = Math.max(minWidth, boundedRight - left);
  const height = Math.max(minHeight, boundedBottom - top);
  return Object.freeze({
    x: clampToBounds(left, 0, Math.max(0, 1 - width)),
    y: clampToBounds(top, 0, Math.max(0, 1 - height)),
    width: clampToBounds(width, minWidth, 1),
    height: clampToBounds(height, minHeight, 1),
  });
}

function resolveReleaseSnappedFrame(input: {
  readonly frame: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly snapModel: CanvasSurfaceSnapModel;
}): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  if (input.snapModel.targets?.bounds) {
    return normalizeSnappedFrame({
      frame: input.frame,
      divisions: input.snapModel.divisions,
    });
  }
  const snappedWidth = input.snapModel.targets?.size
    ? snapNormalized(input.frame.width, input.snapModel.divisions.x)
    : input.frame.width;
  const snappedHeight = input.snapModel.targets?.size
    ? snapNormalized(input.frame.height, input.snapModel.divisions.y)
    : input.frame.height;
  const snappedX = input.snapModel.targets?.position
    ? snapNormalized(input.frame.x, input.snapModel.divisions.x)
    : input.frame.x;
  const snappedY = input.snapModel.targets?.position
    ? snapNormalized(input.frame.y, input.snapModel.divisions.y)
    : input.frame.y;
  return Object.freeze({
    x: clampToBounds(snappedX, 0, Math.max(0, 1 - snappedWidth)),
    y: clampToBounds(snappedY, 0, Math.max(0, 1 - snappedHeight)),
    width: clampToBounds(snappedWidth, resolveSnapStep(input.snapModel.divisions.x), 1),
    height: clampToBounds(snappedHeight, resolveSnapStep(input.snapModel.divisions.y), 1),
  });
}

function resolveEffectiveSnapModel(snap: CanvasSurfaceSnapModel | undefined): CanvasSurfaceSnapModel | undefined {
  if (!snap?.enabled) {
    return undefined;
  }
  return Object.freeze({
    ...snap,
    divisions: Object.freeze({
      x: Number.isFinite(snap.divisions.x) && snap.divisions.x > 0 ? Math.floor(snap.divisions.x) : 1,
      y: Number.isFinite(snap.divisions.y) && snap.divisions.y > 0 ? Math.floor(snap.divisions.y) : 1,
    }),
    timing: Object.freeze({
      duringDrag: snap.timing?.duringDrag ?? false,
      onRelease: snap.timing?.onRelease ?? true,
    }),
    targets: Object.freeze({
      position: snap.targets?.position ?? true,
      size: snap.targets?.size ?? false,
      bounds: snap.targets?.bounds ?? false,
    }),
  });
}

function resolveDesignFrameRatio(editingModel: CanvasSurfaceEditingModel): number {
  const ratio = editingModel.designFrame?.ratio;
  if (ratio && ratio.width > 0 && ratio.height > 0) {
    return ratio.width / ratio.height;
  }
  const dimensions = editingModel.designFrame?.dimensions;
  if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
    return dimensions.width / dimensions.height;
  }
  return 16 / 9;
}

function mapResizeFrame(
  node: CanvasSurfaceLayoutNodeModel,
  deltaX: number,
  deltaY: number,
  handle: "se" | "sw" | "ne" | "nw",
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const minWidth = node.minWidth ?? 140;
  const minHeight = node.minHeight ?? 90;

  if (handle === "se") {
    return {
      x: node.x,
      y: node.y,
      width: clamp(node.width + deltaX, minWidth),
      height: clamp(node.height + deltaY, minHeight),
    };
  }

  if (handle === "sw") {
    const width = clamp(node.width - deltaX, minWidth);
    return {
      x: node.x + (node.width - width),
      y: node.y,
      width,
      height: clamp(node.height + deltaY, minHeight),
    };
  }

  if (handle === "ne") {
    const height = clamp(node.height - deltaY, minHeight);
    return {
      x: node.x,
      y: node.y + (node.height - height),
      width: clamp(node.width + deltaX, minWidth),
      height,
    };
  }

  const width = clamp(node.width - deltaX, minWidth);
  const height = clamp(node.height - deltaY, minHeight);
  return {
    x: node.x + (node.width - width),
    y: node.y + (node.height - height),
    width,
    height,
  };
}

type CanvasDragResizeHandle = "se" | "sw" | "ne" | "nw";

interface CanvasNodeInteractionState {
  readonly mode: "move" | "resize";
  readonly nodeId: string;
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly nodeStartX: number;
  readonly nodeStartY: number;
  readonly nodeStartWidth: number;
  readonly nodeStartHeight: number;
  readonly hasCrossedMoveThreshold: boolean;
  readonly resizeHandle?: CanvasDragResizeHandle;
}

function ConfigurableCanvasEditingSurface({
  editingModel,
  onEditingEvent,
}: {
  readonly editingModel: CanvasSurfaceEditingModel;
  readonly onEditingEvent?: (event: CanvasSurfaceEditingEvent) => void;
}): JSX.Element {
  const [interactionState, setInteractionState] = useState<CanvasNodeInteractionState | undefined>(undefined);

  const nodesById = useMemo(
    () => new Map(editingModel.nodes.map((node) => [node.id, node] as const)),
    [editingModel.nodes],
  );
  const frameRef = useRef<HTMLDivElement | null>(null);
  const coordinateMode = editingModel.coordinateSpace?.mode ?? "absolute";
  const snapModel = resolveEffectiveSnapModel(editingModel.snap);

  const toFrameCoordinate = (pixelValue: number, frameSize: number): number => {
    if (coordinateMode === "normalized") {
      return clamp01(frameSize <= 0 ? 0 : pixelValue / frameSize);
    }
    return Math.round(pixelValue);
  };

  const toFrameSizeCoordinate = (pixelValue: number, frameSize: number): number => {
    if (coordinateMode === "normalized") {
      return Math.max(0.04, clamp01(frameSize <= 0 ? 0 : pixelValue / frameSize));
    }
    return Math.max(24, Math.round(pixelValue));
  };

  const resolvePointerCoordinates = (event: PointerEvent): { readonly x: number; readonly y: number } => Object.freeze({
    x: event.clientX,
    y: event.clientY,
  });

  const resolveViewportModel = (): CanvasSurfaceViewportModel | undefined => {
    const frameRect = frameRef.current?.getBoundingClientRect();
    if (!frameRect || frameRect.width <= 0 || frameRect.height <= 0) {
      return undefined;
    }
    return Object.freeze({
      center: Object.freeze({
        x: toFrameCoordinate(frameRect.width / 2, frameRect.width),
        y: toFrameCoordinate(frameRect.height / 2, frameRect.height),
      }),
      bounds: Object.freeze({
        x: toFrameCoordinate(0, frameRect.width),
        y: toFrameCoordinate(0, frameRect.height),
        width: toFrameSizeCoordinate(frameRect.width, frameRect.width),
        height: toFrameSizeCoordinate(frameRect.height, frameRect.height),
      }),
    });
  };

  const emitNodeMoveChange = (state: CanvasNodeInteractionState, coordinates: { readonly x: number; readonly y: number }): void => {
    const frameRect = frameRef.current?.getBoundingClientRect();
    const frameWidth = frameRect?.width ?? 0;
    const frameHeight = frameRect?.height ?? 0;
    const deltaX = coordinates.x - state.startClientX;
    const deltaY = coordinates.y - state.startClientY;
    let x = toFrameCoordinate(state.nodeStartX + deltaX, frameWidth);
    let y = toFrameCoordinate(state.nodeStartY + deltaY, frameHeight);
    if (snapModel?.targets?.position && snapModel.timing?.duringDrag && coordinateMode === "normalized") {
      x = snapNormalized(x, snapModel.divisions.x);
      y = snapNormalized(y, snapModel.divisions.y);
    }
    onEditingEvent?.({
      type: "node.position.change",
      nodeId: state.nodeId,
      position: Object.freeze({ x, y }),
      phase: "transient",
    });
  };

  const emitNodeResizeChange = (state: CanvasNodeInteractionState, coordinates: { readonly x: number; readonly y: number }): void => {
    const deltaX = coordinates.x - state.startClientX;
    const deltaY = coordinates.y - state.startClientY;
    const frame = mapResizeFrame({
      id: state.nodeId,
      title: "",
      x: state.nodeStartX,
      y: state.nodeStartY,
      width: state.nodeStartWidth,
      height: state.nodeStartHeight,
      minWidth: 48,
      minHeight: 48,
    }, deltaX, deltaY, state.resizeHandle ?? "se");
    const frameRect = frameRef.current?.getBoundingClientRect();
    const frameWidth = frameRect?.width ?? 0;
    const frameHeight = frameRect?.height ?? 0;
    let nextFrame = Object.freeze({
      x: toFrameCoordinate(frame.x, frameWidth),
      y: toFrameCoordinate(frame.y, frameHeight),
      width: toFrameSizeCoordinate(frame.width, frameWidth),
      height: toFrameSizeCoordinate(frame.height, frameHeight),
    });
    if (snapModel?.targets?.size && snapModel.timing?.duringDrag && coordinateMode === "normalized") {
      const snappedWidth = snapNormalized(nextFrame.width, snapModel.divisions.x);
      const snappedHeight = snapNormalized(nextFrame.height, snapModel.divisions.y);
      nextFrame = Object.freeze({
        ...nextFrame,
        width: snappedWidth,
        height: snappedHeight,
        x: clampToBounds(nextFrame.x, 0, Math.max(0, 1 - snappedWidth)),
        y: clampToBounds(nextFrame.y, 0, Math.max(0, 1 - snappedHeight)),
      });
    }
    onEditingEvent?.({
      type: "node.resize.change",
      nodeId: state.nodeId,
      frame: nextFrame,
      phase: "transient",
    });
  };

  useEffect(() => {
    if (!interactionState) {
      return;
    }

    const moveThreshold = 3;
    const handleWindowPointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== interactionState.pointerId || !nodesById.get(interactionState.nodeId)) {
        return;
      }

      const coordinates = resolvePointerCoordinates(event);
      if (interactionState.mode === "move" && !interactionState.hasCrossedMoveThreshold) {
        const deltaX = Math.abs(coordinates.x - interactionState.startClientX);
        const deltaY = Math.abs(coordinates.y - interactionState.startClientY);
        if (Math.max(deltaX, deltaY) < moveThreshold) {
          return;
        }
        const nextState: CanvasNodeInteractionState = Object.freeze({
          ...interactionState,
          hasCrossedMoveThreshold: true,
        });
        setInteractionState(nextState);
        emitNodeMoveChange(nextState, coordinates);
        return;
      }

      if (interactionState.mode === "move") {
        emitNodeMoveChange(interactionState, coordinates);
        return;
      }

      emitNodeResizeChange(interactionState, coordinates);
    };

    const completeInteraction = (event: PointerEvent): void => {
      if (event.pointerId !== interactionState.pointerId) {
        return;
      }
      const coordinates = resolvePointerCoordinates(event);
      if (interactionState.mode === "move" && interactionState.hasCrossedMoveThreshold) {
        const frameRect = frameRef.current?.getBoundingClientRect();
        const frameWidth = frameRect?.width ?? 0;
        const frameHeight = frameRect?.height ?? 0;
        const deltaX = coordinates.x - interactionState.startClientX;
        const deltaY = coordinates.y - interactionState.startClientY;
        const rawFrame = Object.freeze({
          x: toFrameCoordinate(interactionState.nodeStartX + deltaX, frameWidth),
          y: toFrameCoordinate(interactionState.nodeStartY + deltaY, frameHeight),
          width: interactionState.nodeStartWidth,
          height: interactionState.nodeStartHeight,
        });
        const releaseFrame = (coordinateMode === "normalized" && snapModel?.timing?.onRelease)
          ? resolveReleaseSnappedFrame({
            frame: rawFrame,
            snapModel,
          })
          : rawFrame;
        onEditingEvent?.({
          type: "node.position.change",
          nodeId: interactionState.nodeId,
          position: Object.freeze({
            x: releaseFrame.x,
            y: releaseFrame.y,
          }),
          phase: "commit",
        });
      }
      if (interactionState.mode === "resize") {
        const deltaX = coordinates.x - interactionState.startClientX;
        const deltaY = coordinates.y - interactionState.startClientY;
        const frame = mapResizeFrame({
          id: interactionState.nodeId,
          title: "",
          x: interactionState.nodeStartX,
          y: interactionState.nodeStartY,
          width: interactionState.nodeStartWidth,
          height: interactionState.nodeStartHeight,
          minWidth: 48,
          minHeight: 48,
        }, deltaX, deltaY, interactionState.resizeHandle ?? "se");
        const frameRect = frameRef.current?.getBoundingClientRect();
        const frameWidth = frameRect?.width ?? 0;
        const frameHeight = frameRect?.height ?? 0;
        const rawFrame = Object.freeze({
          x: toFrameCoordinate(frame.x, frameWidth),
          y: toFrameCoordinate(frame.y, frameHeight),
          width: toFrameSizeCoordinate(frame.width, frameWidth),
          height: toFrameSizeCoordinate(frame.height, frameHeight),
        });
        const releaseFrame = (coordinateMode === "normalized" && snapModel?.timing?.onRelease)
          ? resolveReleaseSnappedFrame({
            frame: rawFrame,
            snapModel,
          })
          : rawFrame;
        onEditingEvent?.({
          type: "node.resize.change",
          nodeId: interactionState.nodeId,
          frame: releaseFrame,
          phase: "commit",
        });
      }
      setInteractionState(undefined);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", completeInteraction);
    window.addEventListener("pointercancel", completeInteraction);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", completeInteraction);
      window.removeEventListener("pointercancel", completeInteraction);
    };
  }, [coordinateMode, interactionState, nodesById, onEditingEvent, snapModel]);

  const boundedPadding = editingModel.designFrame?.boundedArea?.padding ?? 16;
  const designFrameRatio = resolveDesignFrameRatio(editingModel);

  return (
    <div className="ui-stack ui-stack--2xs" data-testid="configurable-canvas-editing-surface">
      {editingModel.commands?.length ? (
        <div className="ui-configurable-canvas-editor__control-bar ui-row ui-row--wrap" data-testid="configurable-canvas-command-bar">
          {editingModel.commands.map((command) => (
            <button
              key={command.id}
              type="button"
              className={`ui-button ui-button--sm ${command.tone === "primary" ? "ui-button--primary" : command.tone === "ghost" ? "ui-button--ghost" : ""}`.trim()}
              disabled={command.disabled}
              onClick={() => onEditingEvent?.({
                type: "canvas.command",
                commandId: command.id,
                viewport: resolveViewportModel(),
              })}
            >
              {command.label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="ui-configurable-canvas-editor ui-canvas-surface"
        onDoubleClick={(event) => {
          const rect = frameRef.current?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
          onEditingEvent?.({
            type: "node.create.request",
            position: Object.freeze({
              x: toFrameCoordinate(event.clientX - rect.left, rect.width),
              y: toFrameCoordinate(event.clientY - rect.top, rect.height),
            }),
          });
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onEditingEvent?.({ type: "selection.change", nodeId: undefined });
          }
        }}
      >
        <div
          ref={frameRef}
          className="ui-configurable-canvas-editor__design-frame"
          style={{
            inset: `${boundedPadding}px`,
            aspectRatio: `${designFrameRatio}`,
          }}
          data-testid="configurable-canvas-design-frame"
        >
          {editingModel.nodes.map((node) => {
            const selected = editingModel.selectedNodeId === node.id;
            return (
              <article
                key={node.id}
                className={[
                  "ui-configurable-canvas-layout-node",
                  "ui-card",
                  "ui-card--padded",
                  selected ? "ui-configurable-canvas-layout-node--selected" : "",
                  interactionState?.nodeId === node.id ? "ui-configurable-canvas-layout-node--dragging" : "",
                ].filter(Boolean).join(" ")}
                style={{
                  left: `${coordinateMode === "normalized" ? node.x * 100 : node.x}${coordinateMode === "normalized" ? "%" : "px"}`,
                  top: `${coordinateMode === "normalized" ? node.y * 100 : node.y}${coordinateMode === "normalized" ? "%" : "px"}`,
                  width: `${coordinateMode === "normalized" ? node.width * 100 : node.width}${coordinateMode === "normalized" ? "%" : "px"}`,
                  height: `${coordinateMode === "normalized" ? node.height * 100 : node.height}${coordinateMode === "normalized" ? "%" : "px"}`,
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (node.selectable !== false) {
                    onEditingEvent?.({ type: "selection.change", nodeId: node.id });
                  }
                }}
                onPointerDown={(event) => {
                  if (node.movable === false) {
                    return;
                  }
                  if (event.button !== 0) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  const frameRect = frameRef.current?.getBoundingClientRect();
                  const width = frameRect?.width ?? 1;
                  const height = frameRect?.height ?? 1;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setInteractionState({
                    mode: "move",
                    nodeId: node.id,
                    pointerId: event.pointerId,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    nodeStartX: coordinateMode === "normalized" ? node.x * width : node.x,
                    nodeStartY: coordinateMode === "normalized" ? node.y * height : node.y,
                    nodeStartWidth: coordinateMode === "normalized" ? node.width * width : node.width,
                    nodeStartHeight: coordinateMode === "normalized" ? node.height * height : node.height,
                    hasCrossedMoveThreshold: false,
                  });
                }}
                data-testid={`configurable-canvas-layout-node-${node.id}`}
              >
                <div className="ui-stack ui-stack--3xs">
                  <strong className="ui-text-small">{node.title}</strong>
                  {node.subtitle ? <span className="ui-text-small ui-text-secondary">{node.subtitle}</span> : null}
                </div>

                {node.resizable !== false ? (["nw", "ne", "sw", "se"] as const).map((handle) => (
                  <button
                    key={`${node.id}-${handle}`}
                    type="button"
                    className={`ui-configurable-canvas-layout-node__resize ui-configurable-canvas-layout-node__resize--${handle}`}
                    aria-label={`Resize ${node.title}`}
                    onPointerDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      const frameRect = frameRef.current?.getBoundingClientRect();
                      const width = frameRect?.width ?? 1;
                      const height = frameRect?.height ?? 1;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setInteractionState({
                        mode: "resize",
                        nodeId: node.id,
                        pointerId: event.pointerId,
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                        resizeHandle: handle,
                        nodeStartX: coordinateMode === "normalized" ? node.x * width : node.x,
                        nodeStartY: coordinateMode === "normalized" ? node.y * height : node.y,
                        nodeStartWidth: coordinateMode === "normalized" ? node.width * width : node.width,
                        nodeStartHeight: coordinateMode === "normalized" ? node.height * height : node.height,
                        hasCrossedMoveThreshold: true,
                      });
                    }}
                  />
                )) : null}
              </article>
            );
          })}
        </div>

        <div className="ui-configurable-canvas-editor__hint ui-text-small ui-text-secondary">
          {editingModel.createNodeDescription ?? "Double-click the canvas to add a new block."}
        </div>
      </div>
    </div>
  );
}

export default function ConfigurableCanvasSurface<TContext = never>(
  props: ConfigurableCanvasSurfaceProps<TContext>,
): JSX.Element {
  const resolvedModel: ResolvedCanvasModel = isDefinitionProps(props)
    ? (() => {
      const focusedTarget = props.definition.resolveFocusedTarget?.(props.definitionContext);
      return {
        identity: props.definition.identity,
        graphSummary: props.definition.resolveGraphSummary(props.definitionContext),
        focusedTarget,
        palette: props.definition.resolvePalette?.(props.definitionContext),
        issues: props.definition.resolveIssues?.(props.definitionContext) ?? [],
        toolbarActions: props.definition.resolveToolbarActions?.(props.definitionContext) ?? [],
        editingModel: props.definition.resolveEditingModel?.(props.definitionContext),
        onEditingEvent: props.definition.onEditingEvent
          ? (event) => props.definition.onEditingEvent?.({
            context: props.definitionContext,
            event,
          })
          : undefined,
        renderGraphInteractionShell: props.definition.renderGraphInteractionShell
          ? () => props.definition.renderGraphInteractionShell?.({
            context: props.definitionContext,
            interaction: { focusedTarget },
          })
          : undefined,
        renderPaletteRegion: props.definition.renderPaletteRegion
          ? () => props.definition.renderPaletteRegion?.(props.definitionContext)
          : undefined,
        renderInspectorRegion: props.definition.renderInspectorRegion
          ? () => props.definition.renderInspectorRegion?.({
            context: props.definitionContext,
            inspector: { focusedTarget },
          })
          : undefined,
        renderSupplementaryPanels: props.definition.renderSupplementaryPanels
          ? () => props.definition.renderSupplementaryPanels?.(props.definitionContext)
          : undefined,
        interactionMessage: props.definition.resolveInteractionMessage?.(props.definitionContext),
        isEmpty: props.definition.emptyState?.when(props.definitionContext) ?? false,
        renderEmptyState: props.definition.emptyState
          ? () => props.definition.emptyState?.render(props.definitionContext) ?? null
          : undefined,
        leftDrawer: props.leftDrawer,
        rightDrawer: props.rightDrawer,
      };
    })()
    : {
      ...props,
      issues: props.issues ?? [],
      toolbarActions: props.toolbarActions ?? [],
      isEmpty: props.isEmpty ?? false,
      renderEmptyState: props.renderEmptyState,
    };

  const issueCount = resolvedModel.graphSummary.issueCount ?? resolvedModel.issues.length;
  const leftDrawerVisible = Boolean(resolvedModel.leftDrawer?.isEnabled && resolvedModel.leftDrawer?.isOpen);
  const rightDrawerVisible = Boolean(resolvedModel.rightDrawer?.isEnabled && resolvedModel.rightDrawer?.isOpen);

  return (
    <div className="ui-stack ui-stack--sm" data-testid="configurable-canvas-surface">
      <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-canvas-shell">
        <header className="ui-row ui-row--between ui-row--wrap">
          <div className="ui-stack ui-stack--3xs">
            <strong>{resolvedModel.identity.title}</strong>
            {resolvedModel.identity.summary ? <span className="ui-text-small ui-text-secondary">{resolvedModel.identity.summary}</span> : null}
          </div>
          <div className="ui-row ui-row--wrap ui-row--end">
            <span className={`ui-badge ${issueCount > 0 ? "ui-badge--warning" : "ui-badge--success"}`}>
              {issueCount > 0 ? `${issueCount} issue(s)` : "No issues"}
            </span>
            <span className="ui-badge ui-badge--neutral">Nodes: {resolvedModel.graphSummary.nodeCount}</span>
            <span className="ui-badge ui-badge--neutral">Edges: {resolvedModel.graphSummary.edgeCount}</span>
          </div>
        </header>

        {resolvedModel.toolbarActions.length > 0 ? (
          <div className="ui-row ui-row--wrap" data-testid="configurable-canvas-toolbar-actions">
            {resolvedModel.toolbarActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`ui-button ui-button--sm ${action.tone === "ghost" ? "ui-button--ghost" : action.tone === "primary" ? "ui-button--primary" : ""}`.trim()}
                disabled={action.disabled}
                onClick={() => action.run?.({ focusedTarget: resolvedModel.focusedTarget })}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}

        {resolvedModel.isEmpty && resolvedModel.renderEmptyState ? resolvedModel.renderEmptyState() : null}

        {resolvedModel.issues.length > 0 ? (
          <details className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-canvas-issues">
            <summary className="ui-text-small">Validation and interaction issues ({resolvedModel.issues.length})</summary>
            <ul className="ui-stack ui-stack--2xs">
              {resolvedModel.issues.map((issue) => (
                <li key={issue.id} className="ui-text-small ui-text-secondary">{issue.message}</li>
              ))}
            </ul>
          </details>
        ) : null}

        {resolvedModel.editingModel ? (
          <ConfigurableCanvasEditingSurface
            editingModel={resolvedModel.editingModel}
            onEditingEvent={resolvedModel.onEditingEvent}
          />
        ) : resolvedModel.renderGraphInteractionShell ? resolvedModel.renderGraphInteractionShell(resolvedModel.focusedTarget) : null}

        {resolvedModel.interactionMessage ? (
          <p className="ui-text-small ui-text-secondary" data-testid="configurable-canvas-interaction-message">
            {resolvedModel.interactionMessage}
          </p>
        ) : null}
      </section>

      {resolvedModel.palette && !leftDrawerVisible && resolvedModel.renderPaletteRegion ? (
        <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-canvas-palette-inline">
          <strong>{resolvedModel.palette.title}</strong>
          {resolvedModel.palette.description ? <p className="ui-text-small ui-text-secondary">{resolvedModel.palette.description}</p> : null}
          {resolvedModel.renderPaletteRegion()}
        </section>
      ) : null}

      {resolvedModel.renderSupplementaryPanels ? resolvedModel.renderSupplementaryPanels() : null}

      {resolvedModel.rightDrawer && rightDrawerVisible && resolvedModel.renderInspectorRegion ? (
        <aside className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-canvas-right-drawer">
          <div className="ui-row ui-row--between ui-row--wrap">
            <strong>{resolvedModel.rightDrawer.label}</strong>
            {resolvedModel.rightDrawer.onClose ? (
              <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={resolvedModel.rightDrawer.onClose}>Close</button>
            ) : null}
          </div>
          {resolvedModel.renderInspectorRegion(resolvedModel.focusedTarget)}
        </aside>
      ) : null}

      {resolvedModel.leftDrawer && leftDrawerVisible && resolvedModel.renderPaletteRegion ? (
        <aside className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-canvas-left-drawer">
          <div className="ui-row ui-row--between ui-row--wrap">
            <strong>{resolvedModel.leftDrawer.label}</strong>
            {resolvedModel.leftDrawer.onClose ? (
              <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={resolvedModel.leftDrawer.onClose}>Close</button>
            ) : null}
          </div>
          {resolvedModel.renderPaletteRegion()}
        </aside>
      ) : null}
    </div>
  );
}
