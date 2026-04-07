import {
  createAtomicAssetPackageManifest,
  createCompositeAssetPackageManifest,
  type AssetPackageManifest,
  type AssetPackageDependencyReference,
} from "./AssetPackageManifest";
import {
  createBundleDependencySnapshot,
  type BundleDependencySnapshot,
  type BundleDependencyEntry,
} from "./BundleDependencySnapshot";
import {
  createExchangeBundle,
  type ExchangeBundle,
  type ExchangeBundleMetadata,
  type ExchangeBundleProvenance,
  type ExchangeBundleSubject,
  type ExchangeBundleDependencySnapshotReference,
} from "./ExchangeBundleDomain";
import {
  ExchangeBundleValidator,
  type ExchangeBundleValidationResult,
} from "./ExchangeBundleValidation";
import {
  ExchangeFormatCompatibilities,
  ExchangeFormatVersionPolicy,
  type ExchangeFormatVersionSupport,
} from "./ExchangeFormatVersioning";
import {
  type SystemPackageManifest,
  type SystemPackageManifestMetadata,
  type SystemPackageManifestNode,
  type SystemPackageManifestEdge,
  type SystemPackageCompositionReference,
} from "./SystemPackageManifest";

export interface SerializedExchangeBundle {
  readonly artifactVersion: "ai-loom.serialized-exchange-bundle.v1";
  readonly bundleFormatVersion: string;
  readonly bundle: {
    readonly bundleId: string;
    readonly formatVersion: string;
    readonly subject: ExchangeBundleSubject;
    readonly metadata: ExchangeBundleMetadata;
    readonly provenance?: ExchangeBundleProvenance;
    readonly dependencySnapshot: ReadonlyArray<ExchangeBundleDependencySnapshotReference>;
    readonly scope: {
      readonly excludesRuntimeState: true;
      readonly excludesDeploymentState: true;
    };
  };
  readonly manifest: AssetPackageManifest | SystemPackageManifest;
  readonly dependencySnapshot: BundleDependencySnapshot;
}

export interface SerializedExchangeBundleArtifact {
  readonly mediaType: "application/vnd.ai-loom.exchange-bundle+json";
  readonly encoding: "utf-8";
  readonly content: string;
  readonly byteLength: number;
  readonly fileName: string;
}

export interface ExchangeBundleSerializationPolicy {
  readonly validator: ExchangeBundleValidator;
  readonly artifactVersion: SerializedExchangeBundle["artifactVersion"];
  readonly mediaType: SerializedExchangeBundleArtifact["mediaType"];
  readonly fileNamePrefix: string;
}

export type ExchangeBundleSerializationResult =
  | {
    readonly ok: true;
    readonly serialized: SerializedExchangeBundle;
    readonly artifact: SerializedExchangeBundleArtifact;
    readonly validation: ExchangeBundleValidationResult;
  }
  | {
    readonly ok: false;
    readonly validation: ExchangeBundleValidationResult;
  };

export interface ExchangeBundleParseFailure {
  readonly kind: "invalid-json" | "invalid-artifact-structure" | "unsupported-artifact-version";
  readonly message: string;
  readonly path?: string;
}

export interface DeserializedExchangeBundle {
  readonly bundle: ExchangeBundle;
  readonly manifest: AssetPackageManifest | SystemPackageManifest;
  readonly dependencySnapshot: BundleDependencySnapshot;
}

export interface ExchangeBundleDeserializationPolicy {
  readonly validator: ExchangeBundleValidator;
  readonly formatVersionPolicy: ExchangeFormatVersionPolicy;
  readonly supportedArtifactVersion: SerializedExchangeBundle["artifactVersion"];
}

export type ExchangeBundleDeserializationResult =
  | {
    readonly ok: true;
    readonly parsed: SerializedExchangeBundle;
    readonly deserialized: DeserializedExchangeBundle;
    readonly validation: ExchangeBundleValidationResult;
    readonly formatVersionSupport: ExchangeFormatVersionSupport;
  }
  | {
    readonly ok: false;
    readonly parseFailure?: ExchangeBundleParseFailure;
    readonly validation?: ExchangeBundleValidationResult;
    readonly formatVersionSupport?: ExchangeFormatVersionSupport;
  };

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function stableStringify(value: unknown): string {
  const normalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) {
      return entry.map((item) => normalize(item));
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const normalized: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort((left, right) => left.localeCompare(right))) {
        normalized[key] = normalize(record[key]);
      }
      return normalized;
    }
    return entry;
  };

  return JSON.stringify(normalize(value), null, 2);
}

function cloneReadonly<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function toSerializedBundle(input: {
  readonly bundle: ExchangeBundle;
  readonly manifest: AssetPackageManifest | SystemPackageManifest;
  readonly dependencySnapshot: BundleDependencySnapshot;
  readonly artifactVersion: SerializedExchangeBundle["artifactVersion"];
}): SerializedExchangeBundle {
  return Object.freeze({
    artifactVersion: input.artifactVersion,
    bundleFormatVersion: input.bundle.formatVersion.value,
    bundle: Object.freeze({
      bundleId: input.bundle.bundleId.value,
      formatVersion: input.bundle.formatVersion.value,
      subject: cloneReadonly(input.bundle.subject),
      metadata: cloneReadonly(input.bundle.metadata),
      provenance: cloneReadonly(input.bundle.provenance),
      dependencySnapshot: cloneReadonly(input.bundle.dependencySnapshot),
      scope: Object.freeze({
        excludesRuntimeState: true,
        excludesDeploymentState: true,
      }),
    }),
    manifest: cloneReadonly(input.manifest),
    dependencySnapshot: cloneReadonly(input.dependencySnapshot),
  });
}

function toFileName(prefix: string, bundle: ExchangeBundle): string {
  const normalizedPrefix = normalizeOptional(prefix) ?? "exchange-bundle";
  return `${normalizedPrefix}-${bundle.bundleId.value.replace(/[^a-zA-Z0-9._-]/g, "-")}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseAssetManifest(payload: unknown): AssetPackageManifest {
  if (!isRecord(payload)) {
    throw new Error("Manifest must be an object.");
  }

  const manifestVersion = typeof payload.manifestVersion === "string" ? payload.manifestVersion : "";
  if (manifestVersion !== "ai-loom.asset-package-manifest.v1") {
    throw new Error("Unsupported asset package manifest version.");
  }

  const subject = payload.subject;
  const metadata = payload.metadata;
  if (!isRecord(subject) || !isRecord(metadata)) {
    throw new Error("Asset package manifest subject and metadata are required.");
  }

  const baseInput = {
    subject: {
      assetId: String(subject.assetId ?? ""),
      versionId: String(subject.versionId ?? ""),
      kind: String(subject.kind ?? "") as "atomic-asset" | "composite-asset",
      taxonomy: cloneReadonly(subject.taxonomy),
    },
    bundleFormatVersion: String(payload.bundleFormatVersion ?? ""),
    metadata: cloneReadonly(metadata),
    contract: cloneReadonly(payload.contract),
    provenance: cloneReadonly(payload.provenance),
    dependencies: cloneReadonly((payload.dependencies ?? []) as ReadonlyArray<AssetPackageDependencyReference>),
  } as const;

  const type = payload.type;
  if (type === "atomic") {
    return createAtomicAssetPackageManifest({
      ...baseInput,
      subject: {
        ...baseInput.subject,
        kind: "atomic-asset",
      },
    });
  }

  if (type === "composite") {
    return createCompositeAssetPackageManifest({
      ...baseInput,
      subject: {
        ...baseInput.subject,
        kind: "composite-asset",
      },
      composition: cloneReadonly((payload.composition ?? []) as ReadonlyArray<{
        readonly alias: string;
        readonly assetId: string;
        readonly versionId?: string;
      }>),
    });
  }

  throw new Error("Asset package manifest type must be 'atomic' or 'composite'.");
}

function sortSystemNodes(nodes: ReadonlyArray<SystemPackageManifestNode>): ReadonlyArray<SystemPackageManifestNode> {
  return Object.freeze([...nodes].sort((left, right) =>
    `${left.kind}:${left.assetId}:${left.versionId}:${left.nodeId}`.localeCompare(`${right.kind}:${right.assetId}:${right.versionId}:${right.nodeId}`)));
}

function sortSystemEdges(edges: ReadonlyArray<SystemPackageManifestEdge>): ReadonlyArray<SystemPackageManifestEdge> {
  return Object.freeze([...edges].sort((left, right) =>
    `${left.edgeKind}:${left.fromNodeId}:${left.toNodeId}:${left.relationRole ?? ""}:${left.alias ?? ""}`
      .localeCompare(`${right.edgeKind}:${right.fromNodeId}:${right.toNodeId}:${right.relationRole ?? ""}:${right.alias ?? ""}`)));
}

function sortSystemComposition(composition: ReadonlyArray<SystemPackageCompositionReference>): ReadonlyArray<SystemPackageCompositionReference> {
  return Object.freeze([...composition].sort((left, right) =>
    `${left.parentAssetId}:${left.parentVersionId}:${left.edgeKind}:${left.childKind}:${left.childAssetId}:${left.childVersionId}:${left.alias ?? ""}`
      .localeCompare(`${right.parentAssetId}:${right.parentVersionId}:${right.edgeKind}:${right.childKind}:${right.childAssetId}:${right.childVersionId}:${right.alias ?? ""}`)));
}

function parseSystemManifest(payload: unknown): SystemPackageManifest {
  if (!isRecord(payload)) {
    throw new Error("Manifest must be an object.");
  }

  if (payload.manifestVersion !== "ai-loom.system-package-manifest.v1") {
    throw new Error("Unsupported system package manifest version.");
  }

  const subject = payload.subject;
  const metadata = payload.metadata;
  if (!isRecord(subject) || !isRecord(metadata)) {
    throw new Error("System package manifest subject and metadata are required.");
  }

  const normalizedMetadata = Object.freeze({
    createdAt: String(metadata.createdAt ?? "").trim(),
    deterministicInputKey: normalizeOptional(typeof metadata.deterministicInputKey === "string" ? metadata.deterministicInputKey : undefined),
    packageLabel: normalizeOptional(typeof metadata.packageLabel === "string" ? metadata.packageLabel : undefined),
    tags: Object.freeze([...(Array.isArray(metadata.tags) ? metadata.tags : []).map((entry) => String(entry).trim()).filter(Boolean)].sort((a, b) => a.localeCompare(b))),
    dependencySnapshotHook: normalizeOptional(typeof metadata.dependencySnapshotHook === "string" ? metadata.dependencySnapshotHook : undefined),
    provenance: cloneReadonly(metadata.provenance),
  } satisfies SystemPackageManifestMetadata);

  if (!normalizedMetadata.createdAt) {
    throw new Error("System package metadata.createdAt is required.");
  }

  return Object.freeze({
    manifestVersion: "ai-loom.system-package-manifest.v1",
    bundleFormatVersion: String(payload.bundleFormatVersion ?? "").trim(),
    subject: Object.freeze({
      assetId: String(subject.assetId ?? "").trim(),
      versionId: String(subject.versionId ?? "").trim(),
      taxonomy: cloneReadonly(subject.taxonomy),
    }),
    metadata: normalizedMetadata,
    nodes: sortSystemNodes(cloneReadonly((payload.nodes ?? []) as ReadonlyArray<SystemPackageManifestNode>)),
    edges: sortSystemEdges(cloneReadonly((payload.edges ?? []) as ReadonlyArray<SystemPackageManifestEdge>)),
    composition: sortSystemComposition(cloneReadonly((payload.composition ?? []) as ReadonlyArray<SystemPackageCompositionReference>)),
    scope: Object.freeze({
      excludesRuntimeState: true,
      excludesDeploymentState: true,
    }),
  });
}

function parseSupportedManifest(payload: unknown): AssetPackageManifest | SystemPackageManifest {
  if (!isRecord(payload)) {
    throw new Error("Serialized manifest is required.");
  }

  const manifestVersion = typeof payload.manifestVersion === "string" ? payload.manifestVersion.trim() : "";
  if (manifestVersion === "ai-loom.asset-package-manifest.v1") {
    return parseAssetManifest(payload);
  }
  if (manifestVersion === "ai-loom.system-package-manifest.v1") {
    return parseSystemManifest(payload);
  }

  throw new Error(`Unsupported manifest version '${manifestVersion}'.`);
}

function parseDependencySnapshot(payload: unknown): BundleDependencySnapshot {
  if (!isRecord(payload)) {
    throw new Error("Serialized dependency snapshot is required.");
  }
  const rootSubject = payload.rootSubject;
  if (!isRecord(rootSubject) || !Array.isArray(payload.entries)) {
    throw new Error("Dependency snapshot rootSubject and entries are required.");
  }

  return createBundleDependencySnapshot({
    rootSubject: {
      kind: String(rootSubject.kind ?? "") as BundleDependencySnapshot["rootSubject"]["kind"],
      assetId: String(rootSubject.assetId ?? ""),
      versionId: String(rootSubject.versionId ?? ""),
    },
    bundleFormatVersion: String(payload.bundleFormatVersion ?? ""),
    entries: cloneReadonly(payload.entries as ReadonlyArray<BundleDependencyEntry>),
  });
}

export class ExchangeBundleSerializer {
  private readonly policy: ExchangeBundleSerializationPolicy;

  public constructor(policy?: Partial<ExchangeBundleSerializationPolicy>) {
    this.policy = Object.freeze({
      validator: policy?.validator ?? new ExchangeBundleValidator(),
      artifactVersion: policy?.artifactVersion ?? "ai-loom.serialized-exchange-bundle.v1",
      mediaType: policy?.mediaType ?? "application/vnd.ai-loom.exchange-bundle+json",
      fileNamePrefix: policy?.fileNamePrefix ?? "exchange-bundle",
    });
  }

  public serialize(input: {
    readonly bundle: ExchangeBundle;
    readonly manifest: AssetPackageManifest | SystemPackageManifest;
    readonly dependencySnapshot: BundleDependencySnapshot;
  }): ExchangeBundleSerializationResult {
    const validation = this.policy.validator.validate(input);
    if (!validation.valid) {
      return Object.freeze({ ok: false, validation });
    }

    const serialized = toSerializedBundle({
      ...input,
      artifactVersion: this.policy.artifactVersion,
    });

    const content = stableStringify(serialized);
    const bytes = new TextEncoder().encode(content);
    const artifact: SerializedExchangeBundleArtifact = Object.freeze({
      mediaType: this.policy.mediaType,
      encoding: "utf-8",
      content,
      byteLength: bytes.byteLength,
      fileName: toFileName(this.policy.fileNamePrefix, input.bundle),
    });

    return Object.freeze({
      ok: true,
      serialized,
      artifact,
      validation,
    });
  }
}

export class ExchangeBundleDeserializer {
  private readonly policy: ExchangeBundleDeserializationPolicy;

  public constructor(policy?: Partial<ExchangeBundleDeserializationPolicy>) {
    this.policy = Object.freeze({
      validator: policy?.validator ?? new ExchangeBundleValidator(),
      formatVersionPolicy: policy?.formatVersionPolicy ?? ExchangeFormatVersionPolicy.default,
      supportedArtifactVersion: policy?.supportedArtifactVersion ?? "ai-loom.serialized-exchange-bundle.v1",
    });
  }

  public deserialize(artifact: Pick<SerializedExchangeBundleArtifact, "content">): ExchangeBundleDeserializationResult {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(artifact.content);
    } catch {
      return Object.freeze({
        ok: false,
        parseFailure: Object.freeze({
          kind: "invalid-json",
          message: "Serialized exchange bundle artifact content must be valid JSON.",
        }),
      });
    }

    if (!isRecord(parsedJson)) {
      return Object.freeze({
        ok: false,
        parseFailure: Object.freeze({
          kind: "invalid-artifact-structure",
          path: "root",
          message: "Serialized exchange bundle artifact must be a JSON object.",
        }),
      });
    }

    const artifactVersion = typeof parsedJson.artifactVersion === "string" ? parsedJson.artifactVersion.trim() : "";
    if (artifactVersion !== this.policy.supportedArtifactVersion) {
      return Object.freeze({
        ok: false,
        parseFailure: Object.freeze({
          kind: "unsupported-artifact-version",
          path: "artifactVersion",
          message: `Serialized exchange bundle artifact version '${artifactVersion}' is not supported.`,
        }),
      });
    }

    try {
      const bundleSection = parsedJson.bundle;
      if (!isRecord(bundleSection)) {
        throw new Error("Serialized bundle section is required.");
      }

      const formatVersionSupport = this.policy.formatVersionPolicy.evaluate(String(bundleSection.formatVersion ?? ""));
      if (formatVersionSupport.compatibility !== ExchangeFormatCompatibilities.compatible) {
        return Object.freeze({
          ok: false,
          formatVersionSupport,
        });
      }

      const bundle = createExchangeBundle({
        bundleId: String(bundleSection.bundleId ?? ""),
        formatVersion: String(bundleSection.formatVersion ?? ""),
        subject: cloneReadonly(bundleSection.subject as ExchangeBundleSubject),
        metadata: cloneReadonly(bundleSection.metadata as ExchangeBundleMetadata),
        provenance: cloneReadonly(bundleSection.provenance as ExchangeBundleProvenance | undefined),
        dependencySnapshot: cloneReadonly(bundleSection.dependencySnapshot as ReadonlyArray<ExchangeBundleDependencySnapshotReference>),
      });

      const manifest = parseSupportedManifest(parsedJson.manifest);
      const dependencySnapshot = parseDependencySnapshot(parsedJson.dependencySnapshot);

      const validation = this.policy.validator.validate({ bundle, manifest, dependencySnapshot });
      if (!validation.valid) {
        return Object.freeze({
          ok: false,
          validation,
          formatVersionSupport,
        });
      }

      const normalizedParsed = toSerializedBundle({
        bundle,
        manifest,
        dependencySnapshot,
        artifactVersion: this.policy.supportedArtifactVersion,
      });

      return Object.freeze({
        ok: true,
        parsed: normalizedParsed,
        deserialized: Object.freeze({ bundle, manifest, dependencySnapshot }),
        validation,
        formatVersionSupport,
      });
    } catch (error) {
      return Object.freeze({
        ok: false,
        parseFailure: Object.freeze({
          kind: "invalid-artifact-structure",
          message: error instanceof Error ? error.message : "Serialized artifact structure is invalid.",
        }),
      });
    }
  }
}
