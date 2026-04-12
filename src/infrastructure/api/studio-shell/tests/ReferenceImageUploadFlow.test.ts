import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "@infrastructure/studio-shell/InMemoryStudioShellRepository";
import { ReferenceImageSystemTemplate } from "@application/system-studio/ReferenceImageSystemTemplate";

function createUploadRootPath(): string {
  return path.join(os.tmpdir(), `ai-loom-reference-image-upload-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

describe("Reference image upload flow", () => {
  it("ingests uploaded files into the reference-image system input dataset instance", async () => {
    const uploadRoot = createUploadRootPath();
    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        referenceImageUploadRootPath: uploadRoot,
      },
    );
    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId,
      assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
      content: JSON.stringify({ systemSpec: {} }),
      metadata: {
        title: "Reference image",
        tags: ["system"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });

    const upload = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      fileName: "demo.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
    });

    expect(upload.ok).toBeTrue();
    expect(upload.data?.datasetInstanceId).toBe("dataset-instance:reference-image:input");
    expect(upload.data?.recordId).toContain("record:");
    expect(upload.data?.image.assetId).toContain("generated-output:");
    expect(upload.data?.image.assetId).toContain(uploadRoot);
    expect(upload.data?.image.width).toBeGreaterThan(0);
    expect(upload.data?.image.height).toBeGreaterThan(0);
    expect(upload.data?.storedFilePath).toBeString();
    expect(fs.existsSync(upload.data!.storedFilePath!)).toBeTrue();
    expect(upload.data?.configuredUploadRootPath).toBe(uploadRoot);
    expect(upload.data?.persistence.resolvedUploadRootPath).toBe(uploadRoot);
    expect(upload.data?.persistence.directoryCreated).toBeTrue();
    expect(upload.data?.persistence.fileBytesWritten).toBeGreaterThan(0);
    expect(upload.data?.persistence.datasetLinkageOnly).toBeFalse();
    expect(upload.data?.persistence.storedFilePathProduced).toBeTrue();
  });

  it("persists uploaded bytes even when sourceImageAssetId is provided", async () => {
    const uploadRoot = createUploadRootPath();
    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        referenceImageUploadRootPath: uploadRoot,
      },
    );
    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId,
      assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
      content: JSON.stringify({ systemSpec: {} }),
      metadata: {
        title: "Reference image",
        tags: ["system"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });

    const upload = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      fileName: "demo.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
      sourceImageAssetId: "asset:image:uploaded-source-1",
    });

    expect(upload.ok).toBeTrue();
    expect(String(upload.data?.image.assetId)).toBe("asset:image:uploaded-source-1");
    expect(upload.data?.storedFilePath).toBeString();
    expect(fs.existsSync(upload.data!.storedFilePath!)).toBeTrue();
    expect(upload.data?.persistence.storedFilePathProduced).toBeTrue();
  });

  it("fails upload ingestion when reference-image payload cannot be written to disk", async () => {
    const blockedRoot = `${createUploadRootPath()}.txt`;
    fs.writeFileSync(blockedRoot, "not-a-directory", "utf8");
    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        referenceImageUploadRootPath: blockedRoot,
      },
    );
    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId,
      assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
      content: JSON.stringify({ systemSpec: {} }),
      metadata: {
        title: "Reference image",
        tags: ["system"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });

    const upload = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      fileName: "demo.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
      sourceImageAssetId: "asset:image:uploaded-source-1",
    });

    expect(upload.ok).toBeFalse();
    expect(upload.error?.message).toContain("ENOTDIR");
  });
});
