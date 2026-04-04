import type {
  AuthProviderKind,
  CredentialPolicy,
  UserIdentity,
  UserIdentityStatus,
} from "../../../src/domain/identity/IdentityDomain";
import {
  evaluateCredentialPolicy,
  evaluateIdentityStatusTransition,
  normalizeIdentityProfile,
  normalizeProviderSubjectReference,
  type IdentityPolicyIssue,
  type IdentityPolicyResult,
  type NormalizedIdentityProfile,
  type ProviderSubjectReference,
} from "../../../src/domain/identity/IdentityPolicy";
import { IdentityPrincipalLookupKinds } from "../../contracts/IdentityApplicationContracts";
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";

export interface IdentityAccountUniquenessConflict {
  readonly code: "username-conflict" | "email-conflict" | "provider-subject-conflict";
  readonly field: "username" | "email" | "providerSubject";
  readonly value: string;
  readonly conflictingUserIdentityId: string;
}

export interface IdentityAccountUniquenessInput {
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly providerReference?: {
    readonly providerId: string;
    readonly providerSubject: string;
    readonly providerKind?: AuthProviderKind;
  };
  readonly excludeUserIdentityId?: string;
}

export interface IdentityAccountUniquenessResult {
  readonly valid: boolean;
  readonly available: boolean;
  readonly normalized?: {
    readonly profile: NormalizedIdentityProfile;
    readonly providerReference?: ProviderSubjectReference;
  };
  readonly conflicts: ReadonlyArray<IdentityAccountUniquenessConflict>;
  readonly issues: ReadonlyArray<IdentityPolicyIssue>;
}

export class IdentityPolicyService {
  public constructor(private readonly lookupRepository: IIdentityLookupRepository) {}

  public normalizeRegistrationInput(
    input: Pick<IdentityAccountUniquenessInput, "username" | "email" | "displayName">,
  ): IdentityPolicyResult<NormalizedIdentityProfile> {
    return normalizeIdentityProfile(input);
  }

  public normalizeProviderReference(
    input: NonNullable<IdentityAccountUniquenessInput["providerReference"]>,
  ): IdentityPolicyResult<ProviderSubjectReference> {
    return normalizeProviderSubjectReference(input);
  }

  public evaluateCredentialCandidate(
    policy: CredentialPolicy,
    candidate: string,
  ): IdentityPolicyResult<{ readonly candidate: string; readonly policyId: string }> {
    return evaluateCredentialPolicy(policy, candidate);
  }

  public evaluateStatusTransition(
    identity: UserIdentity,
    nextStatus: UserIdentityStatus,
    now?: Date,
  ): IdentityPolicyResult<UserIdentity> {
    return evaluateIdentityStatusTransition(identity, nextStatus, now);
  }

  public async checkAccountUniqueness(
    input: IdentityAccountUniquenessInput,
  ): Promise<IdentityAccountUniquenessResult> {
    const normalizedProfile = this.normalizeRegistrationInput(input);
    const normalizedProvider = input.providerReference
      ? this.normalizeProviderReference(input.providerReference)
      : undefined;

    const issues = [
      ...normalizedProfile.issues,
      ...(normalizedProvider?.issues ?? []),
    ];

    if (!normalizedProfile.value || (normalizedProvider && !normalizedProvider.value)) {
      return Object.freeze({
        valid: false,
        available: false,
        normalized: undefined,
        conflicts: Object.freeze([]),
        issues: Object.freeze(issues),
      });
    }

    const conflicts: IdentityAccountUniquenessConflict[] = [];
    const excludeUserIdentityId = input.excludeUserIdentityId?.trim();
    const profile = normalizedProfile.value;

    const usernameMatch = await this.lookupRepository.findUserIdentityByPrincipal({
      kind: IdentityPrincipalLookupKinds.username,
      value: profile.username,
    });
    if (usernameMatch && usernameMatch.id !== excludeUserIdentityId) {
      conflicts.push(Object.freeze({
        code: "username-conflict",
        field: "username",
        value: profile.username,
        conflictingUserIdentityId: usernameMatch.id,
      }));
    }

    if (profile.email) {
      const emailMatch = await this.lookupRepository.findUserIdentityByPrincipal({
        kind: IdentityPrincipalLookupKinds.email,
        value: profile.email,
      });
      if (emailMatch && emailMatch.id !== excludeUserIdentityId) {
        conflicts.push(Object.freeze({
          code: "email-conflict",
          field: "email",
          value: profile.email,
          conflictingUserIdentityId: emailMatch.id,
        }));
      }
    }

    const providerReference = normalizedProvider?.value;
    if (providerReference) {
      const providerMatch = await this.lookupRepository.findUserIdentityByProviderSubject({
        providerId: providerReference.providerId,
        providerSubject: providerReference.providerSubject,
      });
      if (providerMatch && providerMatch.id !== excludeUserIdentityId) {
        conflicts.push(Object.freeze({
          code: "provider-subject-conflict",
          field: "providerSubject",
          value: `${providerReference.providerId}|${providerReference.providerSubject}`,
          conflictingUserIdentityId: providerMatch.id,
        }));
      }
    }

    return Object.freeze({
      valid: true,
      available: conflicts.length === 0,
      normalized: Object.freeze({
        profile,
        providerReference,
      }),
      conflicts: Object.freeze(conflicts),
      issues: Object.freeze(issues),
    });
  }
}

