# AI Companion: Secret Health and Operational Diagnostics

Primary reference: `docs/secret-health-and-operational-diagnostics.md`

## Purpose

Keep diagnostics usage aligned with hardened secret material governance and startup policy behavior.

## Endpoint Summary

- `GET /api/v1/security/secrets/health`: authenticated, high-level health only
- `GET /api/v1/security/secrets/diagnostics`: trusted authenticated session, detailed diagnostics

## What Diagnostics Expose

- service health state + flags
- bootstrap required ids + bootstrap diagnostics + metadata-only material descriptors
- `securityMaterial` lifecycle summary and per-material classification/policy/rotation/backend status
- warning/failure breakdown and `fallbackModeActive` indicators
- explicit `securityMaterial.governanceAssertions` for development-only allowance governance (`warning` vs `blocked`)

## Safety Guarantees

- no plaintext values or decrypted payloads
- no key bytes, ciphertext payloads, or secret-store locator leakage
- diagnostics remain metadata-only and redacted

## Operational Interpretation

- prioritize repository and encryption availability first
- then remediate required-secret bootstrap diagnostics
- treat `securityMaterial.governanceAssertions.entries` as authoritative allowance policy signals
- treat optional fallback diagnostics as non-production signals unless policy explicitly allows lifecycle use
