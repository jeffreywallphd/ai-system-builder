# Ingestion Contracts

Use this family for transport-neutral staged-data intake semantics.

What belongs here:
- staged-data semantic identity and metadata (`id`, `sourceKind`, `originalName`, `createdAt`, `metadata`)
- registration request/result shapes for staged-data intake flows
- normalized storage reference attachment as a backing concern (`descriptor.storage`)

How this differs from storage contracts:
- ingestion contracts define staged-data meaning for inbound content
- storage contracts define artifact capability semantics (store/retrieve/has/delete bytes by key)
- ingestion is above storage mechanics and may be satisfied by storage adapters

Image upload note:
- image upload is one specialized intake path that registers staged data semantics
- it is not the canonical definition of the ingestion model
