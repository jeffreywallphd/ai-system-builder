import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "../../../../../testing/node-test";
import { createLocalArtifactStorageBindingAdapter } from "../createLocalArtifactStorageBindingAdapter";

describe("createLocalArtifactStorageBindingAdapter", () => {
  it("preserves workspace ownership and filters binding reads by workspace", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "artifact-binding-workspace-"));
    const adapter = createLocalArtifactStorageBindingAdapter({ rootDirectory: root });

    const workspaceA = await adapter.upsertArtifactStorageBinding({ binding: { workspaceId: "workspace-a" as never, artifactId: "artifact-1", role: "primary", backing: { kind: "artifact-object", provider: "filesystem", locator: "workspaces/workspace-a/generated/images/x.png" } } });
    const workspaceB = await adapter.upsertArtifactStorageBinding({ binding: { workspaceId: "workspace-b" as never, artifactId: "artifact-1", role: "primary", backing: { kind: "artifact-object", provider: "filesystem", locator: "workspaces/workspace-b/generated/images/x.png" } } });

    expect(workspaceA.ok).toBe(true);
    expect(workspaceB.ok).toBe(true);
    if (!workspaceA.ok || !workspaceB.ok) return;
    expect(workspaceA.value.binding.workspaceId).toBe("workspace-a");
    expect(workspaceB.value.binding.workspaceId).toBe("workspace-b");

    const workspaceARead = await adapter.readArtifactStorageBindings({ workspaceId: "workspace-a" as never, artifactId: "artifact-1" });
    const workspaceBRead = await adapter.readArtifactStorageBindings({ workspaceId: "workspace-b" as never, artifactId: "artifact-1" });

    expect(workspaceARead.ok).toBe(true);
    expect(workspaceBRead.ok).toBe(true);
    if (!workspaceARead.ok || !workspaceBRead.ok) return;
    expect(workspaceARead.value.bindings.map((binding) => binding.workspaceId)).toEqual(["workspace-a"]);
    expect(workspaceBRead.value.bindings.map((binding) => binding.workspaceId)).toEqual(["workspace-b"]);
    expect(JSON.stringify(workspaceARead.value.bindings)).not.toContain("workspace-b/generated");
  });
});
