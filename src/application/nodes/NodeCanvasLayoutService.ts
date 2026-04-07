import type { INode } from "../../../domain/nodes/interfaces/INode";
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
  readonly mode?: "create" | "settle";
  readonly nodeId?: string;
  readonly nodeSize?: {
    readonly width?: number;
    readonly height?: number;
  };
}

interface PlacementSearchConfig {
  readonly maxRadius: number;
  readonly xStep: number;
  readonly yStep: number;
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

    const placementModes = request.mode === "settle"
      ? [this.createSettleSearchConfig(desiredSize), this.createCreateSearchConfig(desiredSize)]
      : [this.createCreateSearchConfig(desiredSize)];

    for (const config of placementModes) {
      const resolvedPosition = this.findNearestAvailablePosition(
        origin,
        desiredSize,
        occupiedBounds,
        config
      );

      if (resolvedPosition) {
        return resolvedPosition;
      }
    }

    return origin;
  }

  private findNearestAvailablePosition(
    origin: { readonly x: number; readonly y: number },
    size: { readonly width: number; readonly height: number },
    occupiedBounds: ReadonlyArray<NodeBounds>,
    config: PlacementSearchConfig
  ): { readonly x: number; readonly y: number } | undefined {
    let bestCandidate:
      | {
          readonly position: { readonly x: number; readonly y: number };
          readonly score: number;
        }
      | undefined;

    for (let radius = 1; radius <= config.maxRadius; radius += 1) {
      for (let deltaY = -radius; deltaY <= radius; deltaY += 1) {
        for (let deltaX = -radius; deltaX <= radius; deltaX += 1) {
          if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) !== radius) {
            continue;
          }

          const candidate = normalizePosition({
            x: origin.x + deltaX * config.xStep,
            y: origin.y + deltaY * config.yStep,
          });

          if (this.hasCollision(candidate, size, occupiedBounds)) {
            continue;
          }

          const score = this.scoreCandidate(origin, candidate);
          if (!bestCandidate || score < bestCandidate.score) {
            bestCandidate = Object.freeze({
              position: candidate,
              score,
            });
          }
        }
      }

      if (bestCandidate) {
        return bestCandidate.position;
      }
    }

    return undefined;
  }

  private createCreateSearchConfig(size: {
    readonly width: number;
    readonly height: number;
  }): PlacementSearchConfig {
    return Object.freeze({
      maxRadius: 24,
      xStep: Math.max(24, Math.round((size.width + NODE_SPACING_X) / 2)),
      yStep: Math.max(24, Math.round((size.height + NODE_SPACING_Y) / 2)),
    });
  }

  private createSettleSearchConfig(size: {
    readonly width: number;
    readonly height: number;
  }): PlacementSearchConfig {
    return Object.freeze({
      maxRadius: 6,
      xStep: Math.max(12, Math.round(Math.min(NODE_SPACING_X, size.width / 6))),
      yStep: Math.max(12, Math.round(Math.min(NODE_SPACING_Y, size.height / 6))),
    });
  }

  private scoreCandidate(
    origin: { readonly x: number; readonly y: number },
    candidate: { readonly x: number; readonly y: number }
  ): number {
    const deltaX = candidate.x - origin.x;
    const deltaY = candidate.y - origin.y;
    const distance = Math.hypot(deltaX, deltaY);
    const axisBias = Math.abs(deltaX) + Math.abs(deltaY);

    return distance * 10 + axisBias;
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
