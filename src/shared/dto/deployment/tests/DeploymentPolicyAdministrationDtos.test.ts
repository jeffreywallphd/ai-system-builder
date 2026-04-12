import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyAdministrationContractVersions,
  createDeploymentPolicyValidationOutcome,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import {
  toPatchDeploymentPolicyAdministrationStateResponseDto,
  toReadDeploymentPolicyAdministrationResponseDto,
  toUpdateDeploymentPolicyAdministrationResponseDto,
  toValidateDeploymentPolicyAdministrationResponseDto,
} from "../DeploymentPolicyAdministrationDtos";

const snapshot = Object.freeze({
  contractVersion: DeploymentPolicyAdministrationContractVersions.v1,
  profileId: "classroom",
  evaluatedAt: "2026-04-07T16:00:00.000Z",
  evaluationLayer: "application",
  preset: {
    profileId: "classroom",
    parentProfileId: "home",
    lineage: ["home", "classroom"],
    inheritedFrom: ["home"],
  },
  families: {
    "sharing-posture": {
      familyId: "sharing-posture",
      settings: {
        defaultWorkspaceVisibility: {
          familyId: "sharing-posture",
          settingKey: "defaultWorkspaceVisibility",
          controlMode: "profile-default-admin-overridable",
          value: "workspace",
          valueType: "string",
          source: "profile-preset",
        },
      },
    },
  },
  summary: {
    familyCount: 1,
    settingCount: 1,
    sourceCounts: {
      "profile-preset": 1,
      "policy-default": 0,
      "admin-state": 0,
    },
    controlModeCounts: {
      "profile-fixed": 0,
      "profile-default-admin-overridable": 1,
      "runtime-admin": 0,
    },
  },
} as const);

describe("DeploymentPolicyAdministrationDtos", () => {
  it("builds canonical read/validate/update response DTOs", () => {
    const validation = createDeploymentPolicyValidationOutcome({
      evaluatedAt: "2026-04-07T16:01:00.000Z",
    });

    const read = toReadDeploymentPolicyAdministrationResponseDto({
      snapshot,
      validation,
    });
    const validate = toValidateDeploymentPolicyAdministrationResponseDto(validation);
    const update = toUpdateDeploymentPolicyAdministrationResponseDto({
      applied: true,
      profileId: "classroom",
      newRevision: 4,
      snapshot,
      validation,
    });

    expect(read.snapshot.contractVersion).toBe(DeploymentPolicyAdministrationContractVersions.v1);
    expect(validate.validation.valid).toBeTrue();
    expect(update.applied).toBeTrue();
    expect(update.profileId).toBe("classroom");
  });

  it("builds patch-state response DTOs", () => {
    const validation = createDeploymentPolicyValidationOutcome({
      issues: [{
        code: "unknown-family",
        path: "state.values",
        message: "Unknown family.",
      }],
      evaluatedAt: "2026-04-07T16:02:00.000Z",
    });

    const response = toPatchDeploymentPolicyAdministrationStateResponseDto({
      profileId: "classroom",
      snapshot,
      validation,
      newRevision: 5,
    });

    expect(response.profileId).toBe("classroom");
    expect(response.newRevision).toBe(5);
    expect(response.validation.valid).toBeFalse();
  });
});
