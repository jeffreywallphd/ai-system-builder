import { describe, expect, it } from "bun:test";
import {
  buildWorkflowStudioCreateNewPath,
  buildWorkflowStudioDuplicatePath,
  buildWorkflowStudioOpenExistingPath,
  buildWorkflowStudioResumeDraftPath,
  resolveWorkflowStudioEntryRoute,
  WorkflowStudioEntryPaths,
} from "../WorkflowStudioEntryRouting";

describe("WorkflowStudioEntryRouting", () => {
  it("resolves explicit new/open/resume workflow entry routes from search params", () => {
    const newEntry = resolveWorkflowStudioEntryRoute("?workflowEntry=new&entryMode=new");
    expect(newEntry.resolvedEntryPath).toBe(WorkflowStudioEntryPaths.new);

    const openEntry = resolveWorkflowStudioEntryRoute("?workflowEntry=open-existing&workflowId=workflow:1");
    expect(openEntry.resolvedEntryPath).toBe(WorkflowStudioEntryPaths.openExisting);
    expect(openEntry.workflowId).toBe("workflow:1");

    const resumeEntry = resolveWorkflowStudioEntryRoute("?workflowEntry=resume-draft&workflowId=workflow:2");
    expect(resumeEntry.resolvedEntryPath).toBe(WorkflowStudioEntryPaths.resumeDraft);
    expect(resumeEntry.workflowId).toBe("workflow:2");

    const duplicateEntry = resolveWorkflowStudioEntryRoute("?workflowEntry=duplicate&workflowId=workflow:3");
    expect(duplicateEntry.resolvedEntryPath).toBe(WorkflowStudioEntryPaths.duplicate);
    expect(duplicateEntry.workflowId).toBe("workflow:3");
  });

  it("derives open/resume from workflow id and draft status when explicit entry is omitted", () => {
    const openFromAsset = resolveWorkflowStudioEntryRoute("?entryMode=asset&assetId=workflow:open");
    expect(openFromAsset.resolvedEntryPath).toBe(WorkflowStudioEntryPaths.openExisting);
    expect(openFromAsset.workflowId).toBe("workflow:open");

    const resumeFromStatus = resolveWorkflowStudioEntryRoute("?entryMode=asset&assetId=workflow:draft&workflowStatus=draft");
    expect(resumeFromStatus.resolvedEntryPath).toBe(WorkflowStudioEntryPaths.resumeDraft);
    expect(resumeFromStatus.workflowId).toBe("workflow:draft");
  });

  it("flags unsupported entry values and safely falls back to default", () => {
    const invalid = resolveWorkflowStudioEntryRoute("?workflowEntry=unsupported");
    expect(invalid.resolvedEntryPath).toBe(WorkflowStudioEntryPaths.default);
    expect(invalid.invalidEntryPath).toBe("unsupported");
  });

  it("builds canonical create/open/resume paths for workflow studio entry links", () => {
    expect(buildWorkflowStudioCreateNewPath()).toContain("workflowEntry=new");
    expect(buildWorkflowStudioOpenExistingPath("workflow:open")).toContain("workflowEntry=open-existing");
    expect(buildWorkflowStudioOpenExistingPath("workflow:open")).toContain("workflowId=workflow%3Aopen");
    expect(buildWorkflowStudioResumeDraftPath("workflow:draft")).toContain("workflowEntry=resume-draft");
    expect(buildWorkflowStudioResumeDraftPath("workflow:draft")).toContain("workflowStatus=draft");
    expect(buildWorkflowStudioDuplicatePath("workflow:copy-source")).toContain("workflowEntry=duplicate");
    expect(buildWorkflowStudioDuplicatePath("workflow:copy-source")).toContain("workflowId=workflow%3Acopy-source");
  });
});
