# Asset Package, Authoring, Build, and Execution Threat Model

- Status: current
- Scope: executable asset packages, Asset Studio, coding models, system builds, previews, capability brokerage, and system-release execution
- Related: ADR-0015, ADR-0029, ADR-0030 through ADR-0034
- Verification: automated negative tests plus Increment 11 manual security review

## Assets to protect

- user and organization data, artifacts, prompts, models, secrets, and identities;
- host filesystem, process, network, credential, and Electron privileges;
- tenant/workspace isolation and authorization policy;
- package, build, release, provenance, and audit integrity;
- source workspaces and the AI System Builder product repository;
- availability of desktop, server, builders, runners, and storage.

## Trust boundaries

Untrusted inputs cross boundaries at package receipt, archive parsing, manifest normalization, dependency resolution, source editing, coding-model context/output, build execution, preview rendering, capability messages, data/model calls, release activation, and cross-workspace/organization reads.

## Threats and required controls

| Threat                               | Example                                                        | Required prevention/detection                                                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package parser abuse                 | traversal, device path, symlink, duplicate path, zip bomb      | streaming bounded parser; canonical relative paths; link/device rejection; entry/size/ratio/time limits; quarantine; fuzz/negative tests                       |
| Identity/integrity substitution      | same version with different bytes, digest confusion, downgrade | digest-before-use; algorithm allowlist; immutable identity; exact locks; downgrade policy; transparency/signature evidence                                     |
| Malicious or vulnerable dependencies | lifecycle script, typosquat, compromised transitive package    | no install during inspect; lockfile; registry/source allowlist; script denial by default; SBOM and audit; sandboxed build; review                              |
| Forged trust/provenance              | metadata says system-trusted                                   | trust derived from configured authority and verified digest/signature; provenance linked by digest; admission decision audit                                   |
| Coding-agent prompt injection        | repository file asks for secrets or publication                | instruction hierarchy outside workspace content; minimal context; tool allowlist; no secrets; no publish/deploy authority; full diff review                    |
| Scope escape                         | agent edits product repo or sibling workspace                  | separate source root; canonical containment on every file operation; no product-repo mount; out-of-scope diff gate                                             |
| Credential theft                     | environment/token read or broker abuse                         | no ambient secrets; opaque secret references; capability authorization; redaction; no host environment passthrough                                             |
| Sandbox escape                       | native exploit, host socket, privileged child                  | patched runtime; non-root ephemeral isolation; no host/container socket; read-only base; minimal mounts; seccomp/platform policy where available; kill/cleanup |
| Egress/exfiltration                  | arbitrary HTTP/DNS                                             | default-deny network; destination/method/size policy; proxy/broker; audit; no raw secret access                                                                |
| Resource exhaustion                  | fork bomb, infinite loop, huge logs/output                     | CPU/memory/process/time/storage/output quotas; cancellation; admission concurrency; bounded persisted logs                                                     |
| UI privilege escalation              | Node/Electron access, navigation, popup, XSS                   | separate origin/frame; no Node/preload; context isolation; Chromium sandbox; CSP; navigation/window/permission denial; schema-valid messages                   |
| Message confusion                    | spoofed origin/run/capability, oversized payload               | origin/source/channel binding; nonce/correlation; schema/version/size validation; replay controls; deny unknown fields/capabilities                            |
| Capability escalation                | asset requests undeclared data/network/model access            | declaration plus admission plus runtime authorization; least privilege; platform denial wins; audit                                                            |
| Tenant/workspace escape              | guessed IDs or package activation leakage                      | explicit organization/workspace context at contracts, repositories, storage, broker, and audit; RLS/containment; negative tests                                |
| Policy weakening                     | security asset grants admin or suppresses audit                | platform-owned compiler; policies may only narrow; mandatory isolation/audit gates; build rejection                                                            |
| Unsafe migrations                    | destructive cross-tenant schema/data change                    | analyzed migration plan; organization scope; compatibility/rollback checks; approval; host-owned migration runner                                              |
| Build/release tampering              | swap artifact after tests                                      | content-addressed artifacts; test/evidence digests; immutable release; verify before activation/run; revoke on mismatch                                        |
| Stale approval                       | code/capability/dependency changed after review                | approvals bind exact source, lock, capability, and evidence digests; change invalidates approval                                                               |
| Audit evasion/privacy leak           | secrets in logs or missing denial events                       | separate append-only security audit; required events; structured redaction; bounded diagnostics; access/retention policy                                       |

## Abuse cases that must fail closed

1. Browse or inspect a package containing install/build scripts without executing any script.
2. Import an archive with traversal, alternate separators, links, duplicate normalized names, or excessive expansion.
3. Resolve a revoked implementation or signer, an unsigned package under signed-only policy, or two equal eligible candidates.
4. Ask a coding model to read outside its assigned root, access credentials, use an unapproved tool/network origin, or publish its patch.
5. Render imported UI that requests Node, preload, popup, navigation, download, clipboard, camera, or arbitrary network access.
6. Execute logic that requests an undeclared capability, changes organization/workspace context, exceeds quota, or sends malformed broker messages.
7. Build a system with missing authorization/audit, incompatible ports, cycles, unsafe migration, unresolved implementation, or mutable dependency.
8. Activate or execute a release whose artifact digest, evidence, approval, compatibility, or revocation status no longer validates.

## Residual risk and release gates

Sandboxing reduces but does not eliminate runtime vulnerabilities. Signed packages can be malicious. Provenance can identify a producer without proving correctness. Therefore imported/authored execution stays unavailable until automated escape/egress/quota/credential/tenant tests pass for the selected adapter and a manual security review records residual risks.

Security incidents can revoke package, implementation, signer, or system-release digests without rewriting history. Revocation must propagate to resolution, activation, preview, and new execution; policy decides whether an already-running isolated task is terminated.
