# StudieLots canonical database

This directory is the single canonical data layer for StudieLots.

Rules:
- Every programme identity is stored once.
- Every course identity is stored once.
- Programme structures reference canonical programme/course identities.
- Term offerings (HT26, VT27, etc.) are relations, not duplicate programme/course definitions.
- Historical credit-transfer decisions are evidence relations, not alternative course databases.
- University-specific, SUSA, HT26 and legacy program-db files are import sources only.
- Runtime code must not treat legacy/import files as authoritative after migration.

Canonical entities:
- programmes
- courses
- programmeStructures
- offerings
- creditTransferEvidence
- providers

Migration must be lossless and conflict-aware. Conflicting verified structures are quarantined for review rather than silently overwritten.
