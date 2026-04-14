# Persistence Contracts

Shared persistence contracts for structured durable application data.

This family defines persistence-boundary vocabulary without choosing an ORM,
query library, or repository implementation strategy.

Current contract scope:

- record identity references (`persistence-record-reference`)
- persistence failure shape (`persistence-error`)
- persistence operation result envelope (`persistence-result`)

These contracts are intentionally distinct from:

- transport response contracts under `modules/contracts/transport`
- artifact/key storage contracts under `modules/contracts/storage`

Adapters can map this vocabulary to Postgres behavior while keeping
implementation details out of the shared contract layer.

