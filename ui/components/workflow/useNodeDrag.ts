import { useCallback, useEffect, useRef, useState } from "react";

export interface NodeDragPosition {
  readonly x: number;
  readonly y: number;
}

export interface NodeDragBounds {
  readonly minX?: number;
  readonly minY?: number;
  readonly maxX?: number;
  readonly maxY?: number;
}

export interface UseNodeDragOptions {
  readonly nodeId: string;
  readonly initialPosition: NodeDragPosition;
  readonly disabled?: boolean;
  readonly gridSize?: number;
  readonly bounds?: NodeDragBounds;
  readonly onDragStart?: (nodeId: string, position: NodeDragPosition) => void;
  readonly onDragMove?: (nodeId: string, position: NodeDragPosition) => void;
  readonly onDragEnd?: (nodeId: string, position: NodeDragPosition) => void;
}

export interface UseNodeDragResult {
  readonly position: NodeDragPosition;
  readonly isDragging: boolean;
  readonly dragHandleProps: {
    readonly onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  };
  readonly resetPosition: (position: NodeDragPosition) => void;
}

interface DragState {
  readonly pointerId: number;
  readonly startPointerX: number;
  readonly startPointerY: number;
  readonly startNodeX: number;
  readonly startNodeY: number;
}

function applyBounds(
  position: NodeDragPosition,
  bounds?: NodeDragBounds
): NodeDragPosition {
  if (!bounds) {
    return position;
  }

  const nextX =
    bounds.minX !== undefined && position.x < bounds.minX
      ? bounds.minX
      : bounds.maxX !== undefined && position.x > bounds.maxX
        ? bounds.maxX
        : position.x;

  const nextY =
    bounds.minY !== undefined && position.y < bounds.minY
      ? bounds.minY
      : bounds.maxY !== undefined && position.y > bounds.maxY
        ? bounds.maxY
        : position.y;

  return Object.freeze({
    x: nextX,
    y: nextY,
  });
}

function applyGrid(position: NodeDragPosition, gridSize?: number): NodeDragPosition {
  if (!gridSize || gridSize <= 1) {
    return position;
  }

  return Object.freeze({
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  });
}

function normalizePosition(position: NodeDragPosition): NodeDragPosition {
  return Object.freeze({
    x: Number.isFinite(position.x) ? position.x : 0,
    y: Number.isFinite(position.y) ? position.y : 0,
  });
}

export function useNodeDrag(options: UseNodeDragOptions): UseNodeDragResult {
  const [position, setPosition] = useState<NodeDragPosition>(
    normalizePosition(options.initialPosition)
  );
  const [isDragging, setIsDragging] = useState(false);

  const dragStateRef = useRef<DragState>();
  const latestOptionsRef = useRef(options);

  useEffect(() => {
    latestOptionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (isDragging) {
      return;
    }

    setPosition(normalizePosition(options.initialPosition));
  }, [options.initialPosition.x, options.initialPosition.y, isDragging]);

  const resetPosition = useCallback((nextPosition: NodeDragPosition) => {
    setPosition(normalizePosition(nextPosition));
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent): void => {
      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      if (event.pointerId !== dragState.pointerId) {
        return;
      }

      const nextPosition = applyBounds(
        {
          x: dragState.startNodeX + (event.clientX - dragState.startPointerX),
          y: dragState.startNodeY + (event.clientY - dragState.startPointerY),
        },
        latestOptionsRef.current.bounds
      );

      setPosition(nextPosition);
      latestOptionsRef.current.onDragMove?.(latestOptionsRef.current.nodeId, nextPosition);
    };

    const handlePointerUp = (event: PointerEvent): void => {
      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      if (event.pointerId !== dragState.pointerId) {
        return;
      }

      const finalPosition = applyGrid(
        applyBounds(position, latestOptionsRef.current.bounds),
        latestOptionsRef.current.gridSize
      );

      dragStateRef.current = undefined;
      setIsDragging(false);
      setPosition(finalPosition);
      latestOptionsRef.current.onDragEnd?.(latestOptionsRef.current.nodeId, finalPosition);
    };

    const handlePointerCancel = (event: PointerEvent): void => {
      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      if (event.pointerId !== dragState.pointerId) {
        return;
      }

      const originalPosition = Object.freeze({
        x: dragState.startNodeX,
        y: dragState.startNodeY,
      });

      dragStateRef.current = undefined;
      setIsDragging(false);
      setPosition(originalPosition);
      latestOptionsRef.current.onDragEnd?.(
        latestOptionsRef.current.nodeId,
        originalPosition
      );
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [position]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      if (latestOptionsRef.current.disabled) {
        return;
      }

      if (event.button !== 0) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-node-drag-ignore='true']")) {
        return;
      }

      event.preventDefault();

      const normalizedStart = normalizePosition(position);

      dragStateRef.current = {
        pointerId: event.pointerId,
        startPointerX: event.clientX,
        startPointerY: event.clientY,
        startNodeX: normalizedStart.x,
        startNodeY: normalizedStart.y,
      };

      setIsDragging(true);
      latestOptionsRef.current.onDragStart?.(
        latestOptionsRef.current.nodeId,
        normalizedStart
      );

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // no-op
      }
    },
    [position]
  );

  return Object.freeze({
    position,
    isDragging,
    dragHandleProps: Object.freeze({
      onPointerDown,
    }),
    resetPosition,
  });
}
