# Storage Contracts

Shared artifact-storage contracts for non-database content:

- uploads and generated outputs
- exports and temporary workspace artifacts
- media/blob content that should not be modeled as relational records

The contract family is intentionally artifact-oriented and key-based:

- key identity helpers (`storage-artifact-key`)
- descriptor metadata (`storage-object-descriptor`)
- store operation (`store-artifact-request`, `store-artifact-result`)
- retrieve operation (`retrieve-artifact-request`, `retrieve-artifact-result`)
- existence check (`has-artifact-request`, `has-artifact-result`)
- delete operation (`delete-artifact-request`, `delete-artifact-result`)

Avoid physical path assumptions in this contract layer. Adapter implementations map keys to filesystem/object-storage details.

Storage keys should be normalized through family helpers to keep operation request/result behavior mechanically consistent.
