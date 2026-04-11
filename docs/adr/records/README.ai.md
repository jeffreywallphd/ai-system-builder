# AI Companion: ADR Records Home

## Audience
- AI assistants creating or updating ADR files.
- Engineers checking ADR naming and supersession rules.

## Purpose
- Canonical ADR file location and indexing rules for decision records.

## ADR Record Contract
- Place all ADR decision files in this folder.
- Use `adr-<NNN>-<kebab-case-title>.md` for human docs and `adr-<NNN>-<kebab-case-title>.ai.md` for AI companions.
- Keep decision numbers unique and strictly increasing; never renumber historical ADRs.
- Keep supersession metadata and replacement links current when statuses change.

## Current Index
- No ADRs recorded yet.
- Add new records in ascending numeric order and keep this index updated.

## Start Here
- [ADR Router](../README.ai.md)
- [ADR Template](../../context/templates/adr.template.ai.md)
- [Architecture Router](../../architecture/README.ai.md)
