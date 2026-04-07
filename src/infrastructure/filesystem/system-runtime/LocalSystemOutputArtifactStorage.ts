import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  PersistWorkflowOutputArtifactRequest,
  PersistWorkflowOutputArtifactResult,
  WorkflowOutputArtifactStorage,
} from "../../../application/system-runtime/WorkflowOutputArtifactStorage";
import { parseStorageLogicalReference } from "../../../application/system-runtime/StorageInstanceProvisioningContract";

export class LocalSystemOutputArtifactStorage implements WorkflowOutputArtifactStorage {
  public constructor(private readonly rootDirectory: string) {}

  public async persist(request: PersistWorkflowOutputArtifactRequest): Promise<PersistWorkflowOutputArtifactResult> {
    if (!(request.payload instanceof Uint8Array) || request.payload.byteLength === 0) {
      throw new Error("invalid-request:Workflow output artifact payload must be a non-empty Uint8Array.");
    }

    const binding = parseStorageLogicalReference(request.datasetStorageBinding.bindingReference);
    if (!binding.area) {
      throw new Error("invalid-request:Storage binding reference must include a logical area.");
    }
    const extension = this.normalizeExtension(request.extensionHint, request.mimeTypeHint);
    const role = request.role.trim();
    const baseName = this.normalizeFileName(request.fileNameHint) ?? `output-${request.assetIndex + 1}`;
    const targetDir = path.join(
      this.rootDirectory,
      sanitizeSegment(binding.instanceId),
      sanitizeSegment(binding.area),
      "runs",
      sanitizeSegment(request.workflowRunId),
      sanitizeSegment(request.materializationId),
    );
    fs.mkdirSync(targetDir, { recursive: true });

    const collision = this.resolveCollisionSafeName(targetDir, `${baseName}-${role}`, extension);
    const absolutePath = path.join(targetDir, collision.fileName);
    fs.writeFileSync(absolutePath, request.payload);

    const relativePath = path.relative(this.rootDirectory, absolutePath).split(path.sep).join("/");
    const storageReference = `${request.datasetStorageBinding.bindingReference}/runs/${encodeURIComponent(request.workflowRunId)}/${encodeURIComponent(request.materializationId)}/${collision.fileName}`;
    const sha256 = crypto.createHash("sha256").update(request.payload).digest("hex");
    const identitySeed = `${sha256}:${relativePath}`;
    const stableId = `generated-output:${request.systemId}:${request.datasetInstanceId}:${crypto.createHash("sha1").update(identitySeed).digest("hex").slice(0, 24)}`;

    return Object.freeze({
      storageReference,
      storageProvider: "storage-instance-filesystem-output-store",
      assetRef: Object.freeze({
        kind: "generated-output",
        stableId,
        outputId: storageReference,
        path: storageReference,
        sourceSystem: "storage-instance-output-storage",
        sourceContext: Object.freeze({
          storageInstanceId: request.datasetStorageBinding.storageInstanceId,
          storageBindingId: request.datasetStorageBinding.bindingId,
          storageBindingArea: request.datasetStorageBinding.bindingArea,
          datasetInstanceId: request.datasetInstanceId,
          materializationId: request.materializationId,
          workflowRunId: request.workflowRunId,
          role: request.role,
          collisionIndex: String(collision.collisionIndex),
        }),
        mimeTypeHint: request.mimeTypeHint,
        formatHint: extension,
      }),
      metadata: Object.freeze({
        fileName: collision.fileName,
        relativePath,
        extension,
        collisionIndex: collision.collisionIndex,
        sha256,
        sizeBytes: request.payload.byteLength,
      }),
    });
  }

  private normalizeExtension(extensionHint?: string, mimeTypeHint?: string): string {
    const hinted = extensionHint?.trim().replace(/^\./, "").toLowerCase();
    if (hinted) {
      return hinted;
    }
    const mime = mimeTypeHint?.trim().toLowerCase();
    if (!mime || !mime.includes("/")) {
      return "png";
    }
    const subtype = mime.split("/")[1]?.trim();
    return subtype || "png";
  }

  private normalizeFileName(input?: string): string | undefined {
    if (!input) {
      return undefined;
    }
    const normalized = input
      .trim()
      .replace(/\.[A-Za-z0-9]+$/, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return normalized || undefined;
  }

  private resolveCollisionSafeName(directory: string, baseName: string, extension: string): {
    readonly fileName: string;
    readonly collisionIndex: number;
  } {
    let collisionIndex = 0;
    while (true) {
      const suffix = collisionIndex === 0 ? "" : `-${collisionIndex}`;
      const fileName = `${baseName}${suffix}.${extension}`;
      if (!fs.existsSync(path.join(directory, fileName))) {
        return Object.freeze({ fileName, collisionIndex });
      }
      collisionIndex += 1;
    }
  }
}

function sanitizeSegment(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9-_:]+/g, "-").replace(/-+/g, "-");
  if (!normalized) {
    throw new Error("Path segment cannot be empty.");
  }
  return normalized;
}
