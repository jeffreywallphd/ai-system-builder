import { createHash } from "node:crypto";
import {
  createExchangeCatalogEntry,
  type ExchangeCatalogEntry,
  type ExchangeCatalogStorageReference,
} from "@domain/exchange/ExchangeCatalog";
import {
  PublishablePackageStatuses,
  withPublishablePackageStatus,
  type PublishablePackage,
} from "@domain/exchange/PublishablePackage";
import { ExchangeBundleDeserializer, type SerializedExchangeBundleArtifact } from "@domain/exchange/ExchangeBundleSerialization";
import {
  ExchangeAccessActions,
  ExchangeAccessDeniedError,
  ExchangeAccessEvaluator,
  type ExchangeAccessContext,
} from "./ExchangeAccessControl";
import type { ExchangeCatalogRepository } from "./ExchangeCatalogServices";
import type { IPublishablePackageRepository } from "./PublishablePackageService";

export interface PublishedPackageRecord {
  readonly recordId: string;
  readonly catalogId: string;
  readonly packageId: string;
  readonly bundleId: string;
  readonly sourceAssetId: string;
  readonly sourceVersionId: string;
  readonly sourceKind: PublishablePackage["source"]["rootSubject"]["kind"];
  readonly publishedAt: string;
  readonly publishedBy?: string;
  readonly sourceType?: string;
  readonly accessPolicyId?: string;
  readonly artifact: {
    readonly mediaType: string;
    readonly location: string;
    readonly byteLength: number;
    readonly sha256: string;
  };
  readonly provenance?: Readonly<Record<string, unknown>>;
}

export interface IPublishedPackageRecordRepository {
  save(record: PublishedPackageRecord): Promise<void>;
  getByPackageId(catalogId: string, packageId: string): Promise<PublishedPackageRecord | undefined>;
}

export class InMemoryPublishedPackageRecordRepository implements IPublishedPackageRecordRepository {
  private readonly records = new Map<string, PublishedPackageRecord>();

  public async save(record: PublishedPackageRecord): Promise<void> {
    this.records.set(this.key(record.catalogId, record.packageId), record);
  }

  public async getByPackageId(catalogId: string, packageId: string): Promise<PublishedPackageRecord | undefined> {
    return this.records.get(this.key(catalogId, packageId));
  }

  private key(catalogId: string, packageId: string): string {
    return `${catalogId.trim()}::${packageId.trim()}`;
  }
}

export type ExchangePublishDecision =
  | {
    readonly allowed: true;
    readonly policyId: string;
  }
  | {
    readonly allowed: false;
    readonly policyId?: string;
    readonly reasonCode:
      | "forbidden"
      | "not-found"
      | "package-not-ready"
      | "artifact-mismatch"
      | "artifact-invalid"
      | "invalid-request"
      | "catalog-write-failed";
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };

export interface ExchangePublishFailure {
  readonly code: ExchangePublishDecision extends { allowed: false; reasonCode: infer Code } ? Code : never;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface PublishPackageRequest {
  readonly catalogId: string;
  readonly packageId: string;
  readonly artifact: SerializedExchangeBundleArtifact;
  readonly context?: ExchangeAccessContext;
  readonly resourceTenantId?: string;
  readonly metadata?: {
    readonly title?: string;
    readonly summary?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly capabilityHints?: ReadonlyArray<string>;
    readonly configurationHints?: Readonly<Record<string, unknown>>;
  };
  readonly publishedAt?: string;
}

export type PublishPackageResult =
  | {
    readonly ok: true;
    readonly package: PublishablePackage;
    readonly catalogEntry: ExchangeCatalogEntry;
    readonly publishedRecord: PublishedPackageRecord;
    readonly decision: ExchangePublishDecision & { readonly allowed: true };
  }
  | {
    readonly ok: false;
    readonly failure: ExchangePublishFailure;
    readonly decision: ExchangePublishDecision;
  };

export interface PublishArtifactReferenceResolver {
  resolve(input: {
    readonly catalogId: string;
    readonly package: PublishablePackage;
    readonly artifact: SerializedExchangeBundleArtifact;
  }): ExchangeCatalogStorageReference;
}

export class LocalFilePublishArtifactReferenceResolver implements PublishArtifactReferenceResolver {
  public constructor(private readonly baseDirectory = "/local/exchange/published") {}

  public resolve(input: {
    readonly catalogId: string;
    readonly package: PublishablePackage;
    readonly artifact: SerializedExchangeBundleArtifact;
  }): ExchangeCatalogStorageReference {
    const safeCatalog = input.catalogId.replace(/[^a-zA-Z0-9._-]/g, "-");
    const safeFile = input.artifact.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
    return Object.freeze({
      storageKind: "local-file",
      location: `${this.baseDirectory}/${safeCatalog}/${safeFile}`,
      mediaType: input.artifact.mediaType,
      byteLength: input.artifact.byteLength,
      sha256: computeSha256(input.artifact.content),
    });
  }
}

function computeSha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function toFailure(input: {
  readonly code: ExchangePublishFailure["code"];
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly policyId?: string;
}): PublishPackageResult {
  return {
    ok: false,
    failure: {
      code: input.code,
      message: input.message,
      details: input.details,
    },
    decision: {
      allowed: false,
      policyId: input.policyId,
      reasonCode: input.code,
      message: input.message,
      details: input.details,
    },
  };
}

export class ExchangePublishWorkflow {
  private readonly deserializer: ExchangeBundleDeserializer;

  public constructor(
    private readonly packages: IPublishablePackageRepository,
    private readonly catalog: ExchangeCatalogRepository,
    private readonly publishedRecords: IPublishedPackageRecordRepository,
    private readonly accessEvaluator: ExchangeAccessEvaluator = new ExchangeAccessEvaluator(),
    private readonly artifactReferenceResolver: PublishArtifactReferenceResolver = new LocalFilePublishArtifactReferenceResolver(),
  ) {
    this.deserializer = new ExchangeBundleDeserializer();
  }

  public async publish(request: PublishPackageRequest): Promise<PublishPackageResult> {
    try {
      const publishable = await this.packages.getById(request.packageId);
      if (!publishable) {
        return toFailure({
          code: "not-found",
          message: `Publishable package '${request.packageId}' was not found.`,
        });
      }

      const accessDecision = this.accessEvaluator.evaluate({
        action: ExchangeAccessActions.managePublishablePackage,
        context: request.context,
        sourceAssetId: publishable.source.rootSubject.assetId,
        sourceVersionId: publishable.source.rootSubject.versionId,
        bundleId: publishable.source.bundleId.value,
        packageId: publishable.packageId.value,
        resourceTenantId: request.resourceTenantId,
      });
      if (!accessDecision.allowed) {
        return toFailure({
          code: "forbidden",
          message: accessDecision.message ?? "Exchange package publish denied.",
          details: { decision: accessDecision },
          policyId: accessDecision.policyId,
        });
      }

      if (!publishable.readiness.isReady || publishable.status !== PublishablePackageStatuses.ready) {
        return toFailure({
          code: "package-not-ready",
          message: "Publishable package must be in ready status before publish.",
          details: {
            status: publishable.status,
            readiness: publishable.readiness,
          },
          policyId: accessDecision.policyId,
        });
      }

      const deserialized = this.deserializer.deserialize({ content: request.artifact.content });
      if (!deserialized.ok) {
        return toFailure({
          code: "artifact-invalid",
          message: "Serialized exchange bundle artifact is invalid for publish.",
          details: {
            parseFailure: deserialized.parseFailure,
            validation: deserialized.validation,
          },
          policyId: accessDecision.policyId,
        });
      }

      const parsed = deserialized.deserialized.bundle;
      if (
        parsed.bundleId.value !== publishable.source.bundleId.value
        || parsed.subject.root.assetId !== publishable.source.rootSubject.assetId
        || parsed.subject.root.versionId !== publishable.source.rootSubject.versionId
        || parsed.subject.root.kind !== publishable.source.rootSubject.kind
      ) {
        return toFailure({
          code: "artifact-mismatch",
          message: "Publish artifact does not match the publishable package source linkage.",
          details: {
            expected: {
              bundleId: publishable.source.bundleId.value,
              assetId: publishable.source.rootSubject.assetId,
              versionId: publishable.source.rootSubject.versionId,
              kind: publishable.source.rootSubject.kind,
            },
            actual: {
              bundleId: parsed.bundleId.value,
              assetId: parsed.subject.root.assetId,
              versionId: parsed.subject.root.versionId,
              kind: parsed.subject.root.kind,
            },
          },
          policyId: accessDecision.policyId,
        });
      }

      const storageReference = this.artifactReferenceResolver.resolve({
        catalogId: request.catalogId,
        package: publishable,
        artifact: request.artifact,
      });

      const entry: ExchangeCatalogEntry = createExchangeCatalogEntry({
        catalogId: request.catalogId,
        package: publishable,
        storageReference,
        metadata: request.metadata,
        registeredAt: request.publishedAt,
        updatedAt: request.publishedAt,
      });

      await this.catalog.saveEntry(entry);

      const publishedAt = request.publishedAt ?? new Date().toISOString();
      const publishedPackage = withPublishablePackageStatus({
        existing: publishable,
        status: PublishablePackageStatuses.published,
        readiness: {
          ...publishable.readiness,
          checkedAt: publishedAt,
          isReady: true,
          validationIssueCount: 0,
        },
        updatedAt: publishedAt,
      });
      await this.packages.save(publishedPackage);

      const publishedBy = request.context?.caller?.callerId?.trim();
      const record: PublishedPackageRecord = Object.freeze({
        recordId: `published:${request.catalogId.trim()}:${publishable.packageId.value}`,
        catalogId: request.catalogId.trim(),
        packageId: publishable.packageId.value,
        bundleId: publishable.source.bundleId.value,
        sourceAssetId: publishable.source.rootSubject.assetId,
        sourceVersionId: publishable.source.rootSubject.versionId,
        sourceKind: publishable.source.rootSubject.kind,
        publishedAt,
        publishedBy: publishedBy || undefined,
        sourceType: request.context?.source,
        accessPolicyId: accessDecision.policyId,
        artifact: {
          mediaType: request.artifact.mediaType,
          location: storageReference.location,
          byteLength: request.artifact.byteLength,
          sha256: computeSha256(request.artifact.content),
        },
        provenance: Object.freeze({
          sourceBundleProvenance: publishable.provenance.sourceBundleProvenance,
          packageOrigin: publishable.provenance.origin,
        }),
      });
      await this.publishedRecords.save(record);

      return {
        ok: true,
        package: publishedPackage,
        catalogEntry: entry,
        publishedRecord: record,
        decision: {
          allowed: true,
          policyId: accessDecision.policyId,
        },
      };
    } catch (error) {
      if (error instanceof ExchangeAccessDeniedError) {
        return toFailure({
          code: "forbidden",
          message: error.decision.message ?? "Exchange package publish denied.",
          details: { decision: error.decision },
          policyId: error.decision.policyId,
        });
      }

      return toFailure({
        code: "catalog-write-failed",
        message: error instanceof Error ? error.message : "Publish workflow failed.",
      });
    }
  }
}

