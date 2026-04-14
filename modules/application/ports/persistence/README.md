# Persistence Port

Application orchestration depends on `PersistenceRecordPort` for structured,
durable record operations.

- load records through `LoadPersistenceRecordRequest`
- save records through `SavePersistenceRecordRequest`
- delete records through `DeletePersistenceRecordRequest`

This seam stays contract-driven and adapter-neutral; Postgres or other
persistence details belong in adapter implementations.
