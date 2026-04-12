import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyResolutionSources,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import {
  DeploymentProfileIds,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyEvaluationSettingPaths,
  type DeploymentPolicyEvaluationContext,
} from "../DeploymentPolicyEvaluationContracts";
import { CanonicalDeploymentPolicySnapshotResolver } from "../CanonicalDeploymentPolicySnapshotResolver";
import {
  DeploymentPolicyEvaluationSeamError,
  DeploymentPolicyEvaluationService,
} from "../DeploymentPolicyEvaluationService";
import type { IDeploymentPolicyEvaluationSnapshotResolverPort } from "../DeploymentPolicyEvaluationPorts";

describe("DeploymentPolicyEvaluationService", () => {
  it("resolves typed settings and derived feature decisions from effective policy snapshot", async () => {
    const service = new DeploymentPolicyEvaluationService(new CanonicalDeploymentPolicySnapshotResolver());

    const context: DeploymentPolicyEvaluationContext = {
      profileId: DeploymentProfileIds.organization,
      evaluatedAt: "2026-04-08T00:00:00.000Z",
    };

    const storageTier = await service.evaluateSetting({
      context,
      path: DeploymentPolicyEvaluationSettingPaths.storageDefaultTier,
    });
    expect(storageTier.value).toBe("server-managed");
    expect(storageTier.source).toBe(DeploymentPolicyResolutionSources.profilePreset);

    const schedulingPolicy = await service.evaluateSchedulingPolicy(context);
    expect(schedulingPolicy.runSubmissionApprovalMode.value).toBe("owner-or-admin");
    expect(schedulingPolicy.highRiskRunRequiresDualApproval.value).toBe(true);

    const securityPolicy = await service.evaluateSecurityPolicy(context);
    expect(securityPolicy.encryptionAtRestRequired.value).toBeTrue();
    expect(securityPolicy.transportTlsRequired.value).toBeTrue();
  });

  it("supports override-record resolution path without exposing catalogs to consumers", async () => {
    const service = new DeploymentPolicyEvaluationService(new CanonicalDeploymentPolicySnapshotResolver());

    const storagePolicy = await service.evaluateStoragePolicy({
      profileId: DeploymentProfileIds.classroom,
      evaluatedAt: "2026-04-08T00:00:00.000Z",
      overrideRecords: [
        {
          profileId: DeploymentProfileIds.classroom,
          familyId: "storage-governance",
          settingKey: "retentionDaysDefault",
          value: 45,
        },
      ],
    });

    expect(storagePolicy.retentionDaysDefault.value).toBe(45);
    expect(storagePolicy.retentionDaysDefault.source).toBe(DeploymentPolicyResolutionSources.adminState);
  });

  it("fails fast when resolver returns incompatible setting value shape", async () => {
    const resolver = new CanonicalDeploymentPolicySnapshotResolver();
    const incompatibleResolver: IDeploymentPolicyEvaluationSnapshotResolverPort = {
      resolveSnapshot(input) {
        const snapshot = resolver.resolveSnapshot(input);
        return Object.freeze({
          ...snapshot,
          families: Object.freeze({
            ...snapshot.families,
            "storage-governance": Object.freeze({
              ...snapshot.families["storage-governance"],
              settings: Object.freeze({
                ...snapshot.families["storage-governance"].settings,
                retentionDaysDefault: Object.freeze({
                  ...snapshot.families["storage-governance"].settings.retentionDaysDefault,
                  value: "invalid",
                }),
              }),
            }),
          }),
        });
      },
    };

    const service = new DeploymentPolicyEvaluationService(incompatibleResolver);

    await expect(service.evaluateStoragePolicy({
      profileId: DeploymentProfileIds.home,
      evaluatedAt: "2026-04-08T00:00:00.000Z",
    })).rejects.toThrow(DeploymentPolicyEvaluationSeamError);
  });
});
