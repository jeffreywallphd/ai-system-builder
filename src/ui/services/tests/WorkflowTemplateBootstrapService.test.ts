import { describe, expect, it, mock } from "bun:test";
import { WorkflowTemplateBootstrapService } from "../WorkflowTemplateBootstrapService";

describe("WorkflowTemplateBootstrapService", () => {
  it("seeds missing starter templates through studio shell publish flow", async () => {
    const initializeStudio = mock(async () => ({ ok: true, data: { activeSessionId: "session-1" } }));
    const createDraft = mock(async (request: { assetId?: string }) => ({ ok: true, data: { draft: { draftId: `${request.assetId}:draft` } } }));
    const transitionLifecycle = mock(async () => ({ ok: true }));
    const publishVersion = mock(async () => ({ ok: true }));
    const filterAssets = mock(async () => ({ ok: true, data: [] }));

    const service = new WorkflowTemplateBootstrapService(
      { initializeStudio, createDraft, transitionLifecycle, publishVersion },
      { filterAssets },
    );

    await service.ensureCoreTemplatesSeeded();

    expect(filterAssets).toHaveBeenCalled();
    expect(initializeStudio).toHaveBeenCalled();
    expect(createDraft).toHaveBeenCalledTimes(4);
    expect(publishVersion).toHaveBeenCalledTimes(4);
  });
});
