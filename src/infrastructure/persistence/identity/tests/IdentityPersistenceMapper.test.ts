import { describe, expect, it } from "bun:test";
import {
  IdentitySessionStatuses,
  UserIdentityStatuses,
} from "../../../../domain/identity/IdentityDomain";
import {
  mapCredentialMaterialRowToRecord,
  mapCredentialPolicyRowToDomain,
  mapSessionRowToDomain,
  mapUserIdentityRowToDomain,
  type CredentialMaterialRow,
  type CredentialPolicyRow,
  type SessionRow,
  type UserIdentityRow,
  type UserProviderLinkRow,
} from "../IdentityPersistenceMapper";

describe("IdentityPersistenceMapper", () => {
  it("maps user identity rows and provider-link credential state to domain contracts", () => {
    const userRow: UserIdentityRow = {
      user_identity_id: "user:1",
      username: "alice",
      email: "alice@example.com",
      display_name: "Alice",
      status: UserIdentityStatuses.active,
      created_at: "2026-04-04T12:00:00.000Z",
      updated_at: "2026-04-04T12:10:00.000Z",
      activated_at: "2026-04-04T12:01:00.000Z",
      suspended_at: null,
      locked_at: null,
      deactivated_at: null,
    };

    const linkRows: UserProviderLinkRow[] = [
      {
        user_identity_id: "user:1",
        provider_id: "provider:local-password",
        provider_subject: "alice-local",
        is_primary: 1,
        linked_at: "2026-04-04T12:00:00.000Z",
        unlinked_at: null,
        credential_status: "active",
        credential_policy_id: "policy:local",
        credential_failed_attempts: 0,
        credential_lockout_until: null,
        credential_password_changed_at: "2026-04-04T12:00:00.000Z",
        credential_reset_required_at: null,
        credential_compromised_at: null,
        credential_disabled_at: null,
        last_authenticated_at: "2026-04-04T12:10:00.000Z",
      },
    ];

    const mapped = mapUserIdentityRowToDomain(userRow, linkRows);
    expect(mapped.id).toBe("user:1");
    expect(mapped.linkedProviders[0]?.credentialState?.policyId).toBe("policy:local");
    expect(mapped.linkedProviders[0]?.isPrimary).toBeTrue();
  });

  it("maps policy rows and tolerates malformed blocked-substring JSON", () => {
    const malformedJsonRow: CredentialPolicyRow = {
      policy_id: "policy:1",
      min_length: 12,
      max_length: 128,
      require_lowercase: 1,
      require_uppercase: 1,
      require_number: 1,
      require_symbol: 1,
      min_unique_characters: 6,
      max_repeated_characters: 3,
      blocked_substrings_json: "{bad-json",
      min_password_age_days: 0,
      max_password_age_days: 365,
      password_history_count: 10,
      max_failed_attempts: 5,
      lockout_duration_minutes: 15,
    };

    const mapped = mapCredentialPolicyRowToDomain(malformedJsonRow);
    expect(mapped.blockedSubstrings).toEqual([]);
  });

  it("maps credential material and session rows without leaking persistence shape", () => {
    const credentialRow: CredentialMaterialRow = {
      credential_material_id: "credential:1",
      user_identity_id: "user:1",
      provider_id: "provider:local-password",
      provider_subject: "alice-local",
      hash_algorithm: "argon2id",
      hash_value: "hash:v1",
      salt: "salt:v1",
      pepper_version: "pepper:v1",
      status: "active",
      created_at: "2026-04-04T12:00:00.000Z",
      updated_at: "2026-04-04T12:00:00.000Z",
      superseded_at: null,
      expires_at: null,
    };

    const sessionRow: SessionRow = {
      session_id: "session:1",
      user_identity_id: "user:1",
      provider_id: "provider:local-password",
      provider_subject: "alice-local",
      status: IdentitySessionStatuses.revoked,
      issued_at: "2026-04-04T12:00:00.000Z",
      expires_at: "2026-04-04T14:00:00.000Z",
      rotated_at: null,
      replaced_by_session_id: null,
      revocation_reason: "logout",
      revoked_at: "2026-04-04T12:30:00.000Z",
      client_user_agent: "agent",
      client_ip_address: "127.0.0.1",
      client_device_id: "device-1",
    };

    const mappedCredential = mapCredentialMaterialRowToRecord(credentialRow);
    const mappedSession = mapSessionRowToDomain(sessionRow);

    expect(mappedCredential.hashAlgorithm).toBe("argon2id");
    expect(mappedSession.status).toBe(IdentitySessionStatuses.revoked);
    expect(mappedSession.revocation?.reason).toBe("logout");
  });
});
