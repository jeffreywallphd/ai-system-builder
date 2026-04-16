# Ingestion Contracts

Shared ingestion and staged-data contracts for inbound content registration.

This family formalizes transport-neutral ingestion semantics over storage-oriented mechanics:

- constrained ingestion source vocabulary (`upload`, `scrape`, `generated`, `api`, `runtime`)
- staged-data descriptor metadata for canonical inbound object references
- registration request/result shapes for staged-data intake flows

Use this family when behavior is semantically about inbound staged data,
not raw transport or storage mechanics.
