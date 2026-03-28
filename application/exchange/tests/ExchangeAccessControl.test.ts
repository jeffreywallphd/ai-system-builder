import { describe, expect, it } from "bun:test";
import {
  ExchangeAccessActions,
  ExchangeAccessEvaluator,
  RoleBasedExchangeAccessPolicy,
} from "../ExchangeAccessControl";
import { createExchangeBundle } from "../../../domain/exchange/ExchangeBundleDomain";
import { PublishablePackageService, type IPublishablePackageRepository } from "../PublishablePackageService";
import type { PublishablePackage } from "../../../domain/exchange/PublishablePackage";

class InMemoryPublishablePackageRepository implements IPublishablePackageRepository {
  private readonly records = new Map<string, PublishablePackage>();

  public async save(entry: PublishablePackage): Promise<void> {
    this.records.set(entry.packageId.value, entry);
  }

  public async getById(packageId: string): Promise<PublishablePackage | undefined> {
    return this.records.get(packageId);
  }
}

describe("ExchangeAccessControl", () => {
  it("allows authorized export/import decisions and preserves caller+tenant semantics", () => {
    const evaluator = new ExchangeAccessEvaluator(new RoleBasedExchangeAccessPolicy());

    const exportDecision = evaluator.evaluate({
      action: ExchangeAccessActions.exportAtomic,
      context: {
        tenantId: "tenant-a",
        caller: { callerKind: "user", callerId: "user-1", roles: ["exchange-exporter"] },
      },
      sourceAssetId: "asset:model",
      sourceVersionId: "asset:model:v1",
      resourceTenantId: "tenant-a",
    });

    const importDenied = evaluator.evaluate({
      action: ExchangeAccessActions.importAtomic,
      context: {
        tenantId: "tenant-a",
        caller: { callerKind: "user", callerId: "user-1", roles: ["exchange-exporter"] },
      },
      resourceTenantId: "tenant-a",
    });

    expect(exportDecision.allowed).toBeTrue();
    expect(exportDecision.context.callerId).toBe("user-1");
    expect(exportDecision.context.tenantId).toBe("tenant-a");

    expect(importDenied.allowed).toBeFalse();
    expect(importDenied.reasonCode).toBe("missing-role");
    expect(importDenied.context.action).toBe("import-atomic");
  });

  it("denies tenant mismatches and package management without publisher roles", async () => {
    const evaluator = new ExchangeAccessEvaluator(new RoleBasedExchangeAccessPolicy());
    const repository = new InMemoryPublishablePackageRepository();
    const service = new PublishablePackageService(repository, evaluator);

    const bundle = createExchangeBundle({
      bundleId: "exchange:system:system:root:system:root:v1",
      subject: {
        root: { kind: "system-asset", relation: "root", assetId: "system:root", versionId: "system:root:v1" },
        references: [],
      },
      metadata: { createdAt: "2026-03-28T00:00:00.000Z" },
    });

    const deniedCreate = await service.createFromBundle({
      packageId: "package:system:v1",
      bundle,
      context: {
        tenantId: "tenant-a",
        caller: { callerKind: "user", callerId: "user-2", roles: ["exchange-exporter"] },
      },
    });

    const allowedCreate = await service.createFromBundle({
      packageId: "package:system:v1",
      bundle,
      context: {
        tenantId: "tenant-a",
        caller: { callerKind: "user", callerId: "publisher-1", roles: ["exchange-publisher"] },
      },
      readiness: { isReady: true, validationIssueCount: 0 },
      status: "ready",
    });

    const deniedManage = await service.updateStatus({
      packageId: "package:system:v1",
      status: "published",
      context: {
        tenantId: "tenant-a",
        caller: { callerKind: "user", callerId: "importer-1", roles: ["exchange-importer"] },
      },
    });

    const tenantMismatch = evaluator.evaluate({
      action: ExchangeAccessActions.exportSystem,
      context: {
        tenantId: "tenant-a",
        caller: { callerKind: "user", callerId: "user-3", roles: ["exchange-exporter"] },
      },
      resourceTenantId: "tenant-b",
    });

    expect(deniedCreate.ok).toBeFalse();
    if (!deniedCreate.ok) {
      expect(deniedCreate.code).toBe("forbidden");
    }

    expect(allowedCreate.ok).toBeTrue();

    expect(deniedManage.ok).toBeFalse();
    if (!deniedManage.ok) {
      expect(deniedManage.code).toBe("forbidden");
    }

    expect(tenantMismatch.allowed).toBeFalse();
    expect(tenantMismatch.reasonCode).toBe("tenant-mismatch");
  });
});
