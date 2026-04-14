# Configuration Contracts

Typed configuration contracts for host, runtime, logging, persistence, and
storage concerns.

This family is intentionally small:

- concern-specific config shapes (`host`, `runtime`, `logging`, `persistence`,
  `storage`)
- an optional grouped envelope (`system-config`) for composition roots

Non-goals for this layer:

- environment variable loading
- concrete config provider implementation
- framework-specific configuration mechanics

These contracts provide a shared vocabulary so hosts and adapters can consume
typed configuration without leaking transport, runtime, or infrastructure
details into core orchestration layers.
