import type { INode } from "../../domain/nodes/interfaces/INode";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  NODE_SPACING_X,
  NODE_SPACING_Y,
} from "./NodeCanvasLayoutMetrics";

interface NodeBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface ResolveNodePlacementRequest {
  readonly workflow: IWorkflow;
  readonly desiredPosition: {
    readonly x: number;
    readonly y: number;
  };
  readonly nodeId?: string;
  readonly nodeSize?: {
    readonly width?: number;
    readonly height?: number;
  };
}

export class NodeCanvasLayoutService {
  public resolveNodePlacement(
    request: ResolveNodePlacementRequest
  ): { readonly x: number; readonly y: number } {
    const desiredSize = this.resolveNodeSize(request.nodeSize);
    const occupiedBounds = request.workflow.nodes
      .filter((node) => node.id !== request.nodeId)
      .map((node) => this.toBounds(node));
    const origin = normalizePosition(request.desiredPosition);

    if (!this.hasCollision(origin, desiredSize, occupiedBounds)) {
      return origin;
    }

    const xStep = Math.max(24, Math.round((desiredSize.width + NODE_SPACING_X) / 2));
    const yStep = Math.max(24, Math.round((desiredSize.height + NODE_SPACING_Y) / 2));

    for (let radius = 1; radius <= 24; radius += 1) {
      for (let deltaY = -radius; deltaY <= radius; deltaY += 1) {
        for (let deltaX = -radius; deltaX <= radius; deltaX += 1) {
          if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) !== radius) {
            continue;
          }

          const candidate = normalizePosition({
            x: origin.x + deltaX * xStep,
            y: origin.y + deltaY * yStep,
          });

          if (!this.hasCollision(candidate, desiredSize, occupiedBounds)) {
            return candidate;
          }
        }
      }
    }

    return origin;
  }

  private hasCollision(
    position: { readonly x: number; readonly y: number },
    size: { readonly width: number; readonly height: number },
    occupiedBounds: ReadonlyArray<NodeBounds>
  ): boolean {
    const candidateBounds = this.toBounds({
      position,
      size,
    });

    return occupiedBounds.some((occupied) => boundsIntersect(candidateBounds, occupied));
  }

  private toBounds(
    node:
      | INode
      | {
          readonly position?: { readonly x: number; readonly y: number };
          readonly size?: { readonly width?: number; readonly height?: number };
        }
  ): NodeBounds {
    const position = normalizePosition(node.position);
    const size = this.resolveNodeSize(node.size);
    const marginX = NODE_SPACING_X / 2;
    const marginY = NODE_SPACING_Y / 2;

    return Object.freeze({
      left: position.x - marginX,
      top: position.y - marginY,
      right: position.x + size.width + marginX,
      bottom: position.y + size.height + marginY,
    });
  }

  private resolveNodeSize(size?: {
    readonly width?: number;
    readonly height?: number;
  }): { readonly width: number; readonly height: number } {
    return Object.freeze({
      width: Math.max(160, Math.round(size?.width ?? DEFAULT_NODE_WIDTH)),
      height: Math.max(120, Math.round(size?.height ?? DEFAULT_NODE_HEIGHT)),
    });
  }
}

function normalizePosition(position?: {
  readonly x: number;
  readonly y: number;
}): { readonly x: number; readonly y: number } {
  return Object.freeze({
    x: Math.max(0, Math.round(position?.x ?? 0)),
    y: Math.max(0, Math.round(position?.y ?? 0)),
  });
}

function boundsIntersect(left: NodeBounds, right: NodeBounds): boolean {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}
