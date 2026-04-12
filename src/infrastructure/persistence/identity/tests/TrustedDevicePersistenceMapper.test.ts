import { describe, expect, it } from "bun:test";
import { DevicePairingMethods, DeviceTrustStatuses } from "@domain/identity/TrustedDeviceDomain";
import {
  PairingSessionStatuses,
  PairingTokenArtifactTypes,
  PairingTokenStatuses,
} from "@domain/identity/TrustedDevicePairingDomain";
import {
  mapPairingSessionRowToRecord,
  mapPairingTokenRowToRecord,
  mapTrustedDeviceRowToDomain,
  type PairingSessionRow,
  type PairingTokenRow,
  type TrustedDeviceRow,
} from "../TrustedDevicePersistenceMapper";

describe("TrustedDevicePersistenceMapper", () => {
  it("maps trusted-device rows into domain aggregates", () => {
    const row: TrustedDeviceRow = {
      trusted_device_id: "trusted-device:1",
      user_identity_id: "user:1",
      workspace_id: "workspace:1",
      display_name: "Laptop",
      fingerprint_algorithm: "sha256",
      fingerprint_value: "fingerprint:v1",
      fingerprint_captured_at: "2026-04-04T12:00:00.000Z",
      pairing_method: DevicePairingMethods.oneTimeCode,
      trust_status: DeviceTrustStatuses.trusted,
      trust_material_id: "material:1",
      trust_material_kind: "session-signing-key",
      trust_material_version: "v1",
      trust_material_issued_at: "2026-04-04T12:01:00.000Z",
      trust_material_expires_at: null,
      registered_at: "2026-04-04T12:00:00.000Z",
      paired_at: "2026-04-04T12:02:00.000Z",
      last_seen_at: "2026-04-04T12:03:00.000Z",
      metadata_platform: "windows",
      metadata_os_version: "11",
      metadata_app_version: "1.0.0",
      metadata_device_model: "xps",
      metadata_locale: "en-US",
      metadata_last_ip_address: "127.0.0.1",
      revocation_reason: null,
      revoked_at: null,
      revoked_by_user_identity_id: null,
      revocation_note: null,
      updated_at: "2026-04-04T12:03:00.000Z",
    };

    const mapped = mapTrustedDeviceRowToDomain(row);
    expect(mapped.id).toBe("trusted-device:1");
    expect(mapped.trustStatus).toBe(DeviceTrustStatuses.trusted);
    expect(mapped.trustMaterialRef?.kind).toBe("session-signing-key");
  });

  it("maps pairing rows into application records", () => {
    const sessionRow: PairingSessionRow = {
      pairing_session_id: "pairing-session:1",
      trusted_device_id: "trusted-device:1",
      user_identity_id: "user:1",
      workspace_id: "workspace:1",
      pairing_token_id: "pairing-token:1",
      status: PairingSessionStatuses.validated,
      initiated_at: "2026-04-04T12:00:00.000Z",
      validated_at: "2026-04-04T12:01:00.000Z",
      completed_at: null,
      completed_by_user_identity_id: null,
      trust_material_registration_kind: null,
      trust_material_registration_pin_reference: null,
      trust_material_registration_public_key_fingerprint: null,
      rejected_at: null,
      rejection_reason: null,
      rejection_note: null,
      invalidated_at: null,
      expired_at: null,
      updated_at: "2026-04-04T12:01:00.000Z",
    };

    const tokenRow: PairingTokenRow = {
      pairing_token_id: "pairing-token:1",
      pairing_session_id: "pairing-session:1",
      trusted_device_id: "trusted-device:1",
      user_identity_id: "user:1",
      workspace_id: "workspace:1",
      artifact_type: PairingTokenArtifactTypes.oneTimeCode,
      token_hash: "hash:1",
      hash_algorithm: "sha256",
      actor_scope: "same-user",
      actor_user_identity_id: "user:1",
      actor_session_id: null,
      issuance_issued_by_user_identity_id: "user:1",
      issuance_ip_address: "127.0.0.1",
      issuance_user_agent: "agent",
      issuance_channel_hint: "desktop",
      status: PairingTokenStatuses.issued,
      issued_at: "2026-04-04T12:00:00.000Z",
      expires_at: "2026-04-04T12:05:00.000Z",
      failed_validation_attempts: 0,
      max_validation_attempts: 5,
      last_validation_attempt_at: null,
      consumed_at: null,
      consumed_by_user_identity_id: null,
      invalidation_reason: null,
      invalidated_at: null,
      invalidated_by_user_identity_id: null,
      invalidation_note: null,
      updated_at: "2026-04-04T12:00:00.000Z",
    };

    const mappedSession = mapPairingSessionRowToRecord(sessionRow);
    const mappedToken = mapPairingTokenRowToRecord(tokenRow);
    expect(mappedSession.status).toBe(PairingSessionStatuses.validated);
    expect(mappedToken.status).toBe(PairingTokenStatuses.issued);
    expect(mappedToken.actorBinding.scope).toBe("same-user");
  });
});

