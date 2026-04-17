# Storage Contracts

Shared **artifact/object-storage** contracts for non-database content:

- uploads and generated outputs
- exports and temporary workspace artifacts
- media/blob content that should not be modeled as relational records

The contract family is intentionally artifact-oriented and key-based:

- key identity helpers (`storage-artifact-key`)
- storage instance/zone references (`storage-instance-reference`, `storage-zone-kind`)
- storage placement descriptor (`storage-placement-descriptor`)
- descriptor metadata (`storage-object-descriptor`)
- store operation (`store-artifact-request`, `store-artifact-result`)
- retrieve operation (`retrieve-artifact-request`, `retrieve-artifact-result`)
- existence check (`has-artifact-request`, `has-artifact-result`)
- delete operation (`delete-artifact-request`, `delete-artifact-result`)

Zone semantics are intrinsic to storage instances. Placement references instance + key.

This contract family is one storage specialization.
Repository/provider-backed storage semantics may require additional storage contract families (for example provider/repo identity, revision, visibility, publish/import operations) rather than flattening everything into artifact key/blob contracts.

Avoid physical path assumptions in this contract layer. Adapter implementations map keys to filesystem/object-storage details.

Storage keys should be normalized through family helpers to keep operation request/result behavior mechanically consistent.
