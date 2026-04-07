import { describe, expect, it } from "bun:test";
import type { ComfyWorkflowDto } from "../ComfyWorkflowDto";

describe("ComfyWorkflowDto", () => {
  it("represents prompt payload envelope", () => {
    const dto: ComfyWorkflowDto = { prompt: { n1: { class_type: "A", inputs: {} } }, client_id: "wf-1" };
    expect(dto.client_id).toBe("wf-1");
    expect(dto.prompt.n1.class_type).toBe("A");
  });
});
