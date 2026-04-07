import {
  ExchangeAccessActions,
  ExchangeAccessEvaluator,
  ExchangeAccessDeniedError,
  type ExchangeAccessContext,
} from "./ExchangeAccessControl";
import {
  createPublishablePackage,
  withPublishablePackageStatus,
  type PublishablePackage,
  type PublishablePackageStatus,
} from "../../domain/exchange/PublishablePackage";
import type { ExchangeBundle } from "../../domain/exchange/ExchangeBundleDomain";

export interface IPublishablePackageRepository {
  save(entry: PublishablePackage): Promise<void>;
  getById(packageId: string): Promise<PublishablePackage | undefined>;
}

export type CreatePublishablePackageResult = {
  readonly ok: true;
  readonly package: PublishablePackage;
} | {
  readonly ok: false;
  readonly code: "invalid-request" | "forbidden";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

export type UpdatePublishablePackageStatusResult = {
  readonly ok: true;
  readonly package: PublishablePackage;
} | {
  readonly ok: false;
  readonly code: "invalid-request" | "not-found" | "forbidden";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

export class PublishablePackageService {
  public constructor(
    private readonly repository: IPublishablePackageRepository,
    private readonly accessEvaluator: ExchangeAccessEvaluator = new ExchangeAccessEvaluator(),
  ) {}

  public async createFromBundle(input: {
    readonly packageId: string;
    readonly bundle: ExchangeBundle;
    readonly context?: ExchangeAccessContext;
    readonly metadata?: {
      readonly label?: string;
      readonly summary?: string;
      readonly tags?: ReadonlyArray<string>;
      readonly curatedBy?: string;
      readonly curatedAt?: string;
      readonly packageHint?: string;
      readonly capabilityHints?: ReadonlyArray<string>;
      readonly configurationHints?: Readonly<Record<string, unknown>>;
    };
    readonly readiness?: {
      readonly isReady: boolean;
      readonly reasonCodes?: ReadonlyArray<string>;
      readonly checkedAt?: string;
      readonly validationIssueCount?: number;
    };
    readonly status?: PublishablePackageStatus;
  }): Promise<CreatePublishablePackageResult> {
    try {
      this.accessEvaluator.assertAllowed({
        action: ExchangeAccessActions.createPublishablePackage,
        context: input.context,
        sourceAssetId: input.bundle.subject.root.assetId,
        sourceVersionId: input.bundle.subject.root.versionId,
        bundleId: input.bundle.bundleId.value,
      });

      const created = createPublishablePackage({
        packageId: input.packageId,
        source: {
          bundleId: input.bundle.bundleId.value,
          bundleFormatVersion: input.bundle.formatVersion.value,
          rootSubject: {
            kind: input.bundle.subject.root.kind,
            assetId: input.bundle.subject.root.assetId,
            versionId: input.bundle.subject.root.versionId,
          },
          deterministicInputKey: input.bundle.metadata.deterministicInputKey,
        },
        status: input.status,
        readiness: input.readiness,
        metadata: input.metadata,
        provenance: {
          origin: input.bundle.provenance ? "imported" : "curated",
          sourceBundleProvenance: input.bundle.provenance,
        },
      });
      await this.repository.save(created);
      return { ok: true, package: created };
    } catch (error) {
      if (error instanceof ExchangeAccessDeniedError) {
        return {
          ok: false,
          code: "forbidden",
          message: error.decision.message ?? "Exchange access denied.",
          details: { decision: error.decision },
        };
      }

      return {
        ok: false,
        code: "invalid-request",
        message: error instanceof Error ? error.message : "Publishable package request is invalid.",
      };
    }
  }

  public async updateStatus(input: {
    readonly packageId: string;
    readonly status: PublishablePackageStatus;
    readonly context?: ExchangeAccessContext;
    readonly readiness?: {
      readonly isReady: boolean;
      readonly reasonCodes?: ReadonlyArray<string>;
      readonly checkedAt?: string;
      readonly validationIssueCount?: number;
    };
    readonly updatedAt?: string;
  }): Promise<UpdatePublishablePackageStatusResult> {
    try {
      const existing = await this.repository.getById(input.packageId);
      if (!existing) {
        return {
          ok: false,
          code: "not-found",
          message: `Publishable package '${input.packageId}' was not found.`,
        };
      }

      this.accessEvaluator.assertAllowed({
        action: ExchangeAccessActions.managePublishablePackage,
        context: input.context,
        sourceAssetId: existing.source.rootSubject.assetId,
        sourceVersionId: existing.source.rootSubject.versionId,
        bundleId: existing.source.bundleId.value,
        packageId: existing.packageId.value,
      });

      const updated = withPublishablePackageStatus({
        existing,
        status: input.status,
        readiness: input.readiness,
        updatedAt: input.updatedAt,
      });
      await this.repository.save(updated);
      return { ok: true, package: updated };
    } catch (error) {
      if (error instanceof ExchangeAccessDeniedError) {
        return {
          ok: false,
          code: "forbidden",
          message: error.decision.message ?? "Exchange access denied.",
          details: { decision: error.decision },
        };
      }

      return {
        ok: false,
        code: "invalid-request",
        message: error instanceof Error ? error.message : "Publishable package status update is invalid.",
      };
    }
  }
}
