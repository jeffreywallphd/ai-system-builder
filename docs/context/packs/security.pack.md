# Context Pack: Security Architecture

- Pack name: `security`

## Purpose

Summarize the planned security architecture direction for implementation prompts.

## Canonical reference

- ADR-0015 is the canonical security architecture and policy-boundary source.

## Core posture

- Security is cross-cutting but not monolithic.
- Shared security primitives belong in security contracts/ports/adapters.
- Feature code stays in feature areas and consumes shared security seams.
- First implementation target: HTTPS + LAN pairing bearer token.
- Bearer tokens authenticate clients; HTTPS/TLS provides confidentiality/integrity.

## Security domains

Identity/authentication, authorization/policy, transport security, storage security, secrets/credentials, audit logging, input hardening, runtime/process isolation, supply-chain/model/plugin security, and privacy/data governance.

## Layered enforcement model

- Transport boundary: authenticate, coarse scopes, reject malformed/oversized inputs, apply headers/rate limits.
- Application boundary: resource authorization, actor-aware use-case policy, audit events.
- Adapter boundary: path containment, credential storage, optional encryption, runtime hardening, redaction.
- Host composition: mode selection, adapter wiring, credential/security config.

## Route/storage/secret/audit principles

- Route policy should be centralized, not scattered across handlers.
- Storage keys are opaque; path containment is required in filesystem adapters.
- Secrets/credentials are not ordinary settings; never log authorization headers.
- Audit logs are separate from normal diagnostics.

## Dependency rules

- Security contracts can be used broadly.
- Security adapters are outer-layer implementations and must not be imported by domain/application.
- UI must not import server security adapters.

## What not to do

- Do not claim security is fully implemented already.
- Do not claim HTTPS + LAN token is sufficient for public internet production exposure.
- Do not claim bearer tokens encrypt traffic.
- Do not move all feature code into `security/` folders.
