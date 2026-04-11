---
title: "AI Companion: Architecture Domain Folders"
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/architecture-domain-taxonomy.ai.md
---

# AI Companion: Architecture Domain Folders

## Purpose

Define the canonical folder structure under docs/architecture/domains/ for domain-oriented architecture documentation migration.

## Folder Contract

- Use one folder per domain ID from docs/architecture/architecture-domain-taxonomy.ai.md.
- Keep one overview.ai.md per domain as the boundary and routing contract.
- Keep detailed contracts in the domain references/ folder as .ai.md companions.
- Keep markdown and AI companion files aligned during migrations.

## Domain Folders

- [core-platform-and-composition](./core-platform-and-composition/overview.md)
- [runtime-host-surfaces](./runtime-host-surfaces/overview.md)
- [identity-trust-and-security](./identity-trust-and-security/overview.md)
- [workspace-storage-and-assets](./workspace-storage-and-assets/overview.md)
- [execution-control-plane-and-scheduling](./execution-control-plane-and-scheduling/overview.md)
- [studio-and-system-composition](./studio-and-system-composition/overview.md)
- [api-and-transport-surfaces](./api-and-transport-surfaces/overview.md)
- [deployment-policy-and-audit-governance](./deployment-policy-and-audit-governance/overview.md)

## Migration Notes

- These folders are the target migration shape for later stories.
- Existing flat architecture docs remain authoritative until explicitly migrated.
