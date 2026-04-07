import { describe, expect, it } from "bun:test";
import { NodeCanvasLayoutService } from "../NodeCanvasLayoutService";
import { makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";

describe("NodeCanvasLayoutService", () => {
  it("keeps settle adjustments within the nearby settle search window when a gap is available", () => {
    const service = new NodeCanvasLayoutService();
    const workflow = makeWorkflow({
      nodes: [
        makeNode({ id: "left" }).withPosition({ x: 0, y: 0 }),
        makeNode({ id: "moving" }).withPosition({ x: 420, y: 0 }),
      ],
    });

    const resolved = service.resolveNodePlacement({
      workflow,
      nodeId: "moving",
      desiredPosition: { x: 340, y: 0 },
      mode: "settle",
      nodeSize: { width: 360, height: 220 },
    });

    expect(resolved.x).toBe(460);
    expect(resolved.y).toBe(0);
  });

  it("falls back to broader create-style placement when a subtle settle move is unavailable", () => {
    const service = new NodeCanvasLayoutService();
    const workflow = makeWorkflow({
      nodes: [
        makeNode({ id: "left" }).withPosition({ x: 0, y: 0 }),
        makeNode({ id: "right" }).withPosition({ x: 420, y: 0 }),
        makeNode({ id: "top" }).withPosition({ x: 0, y: 292 }),
        makeNode({ id: "bottom" }).withPosition({ x: 420, y: 292 }),
        makeNode({ id: "moving" }).withPosition({ x: 840, y: 0 }),
      ],
    });

    const resolved = service.resolveNodePlacement({
      workflow,
      nodeId: "moving",
      desiredPosition: { x: 210, y: 146 },
      mode: "settle",
      nodeSize: { width: 360, height: 220 },
    });

    expect(Math.abs(resolved.x - 210) + Math.abs(resolved.y - 146)).toBeGreaterThan(72);
  });
});
