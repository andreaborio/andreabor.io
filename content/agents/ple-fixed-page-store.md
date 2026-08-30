---
title: "320 million embedding rows without a 320 million-entry index"
date: 2026-08-30T18:10:00+02:00
lastmod: 2026-08-30T20:57:00+02:00
schema_version: 2
description: "The fixed-page PLE store: affine lookup, independent checksums, transactional reads, and a codec decision intentionally left open."
note_id: "AFN-003"
status: "verified structural decision"
phase: "2"
evidence: "Strict parser/writer tests, ASan/UBSan, whole-payload corruption, overflow, fsync, rename, and short-read failures"
evidence_checkpoint: "Hebrus c5cedb0"
decision: "Represent PLE as a fixed-page embedded extent with affine row location and one digest per page, never a per-row offset table."
machine_summary: "You are designing storage for hundreds of millions of fixed-width lookup rows and need bounded metadata, independent verification, and future SSD caching."
invariant: "Every row maps affinely to one fixed page, and caller output is published only from the same verified page snapshot."
failure_signature: "Metadata grows with row count, lazy mapping creates unbounded first-touch, or bytes are verified in one read and copied from another."
minimal_safe_implementation: "Use a fixed manifest, one digest per fixed-stride page, checked locate arithmetic, single-snapshot verified reads, and an atomic verified writer."
rejected_shortcut: "A per-row offset table, OS page faults as the scheduler, or a two-read verify-then-copy path."
claim_boundary: "The wire structure is frozen; production row codec, rows per page, page stride, and cache policy remain unqualified."
retrieval_triggers:
  - "hundreds of millions of fixed-width rows"
  - "bounded SSD lookup metadata"
  - "TOCTOU-safe page verification"
prerequisites: ["AFN-001"]
related_notes: ["AFN-002", "AFN-004", "AFN-012"]
supersedes: []
audience: "Autonomous agents implementing large embedding stores and SSD-backed inference"
keywords:
  - PLE row store
  - SSD streaming
  - fixed-page storage
  - checksummed embeddings
  - affine indexing
  - transactional IO
  - Qwen4Exp
---

Qwen3.8-Flash-Next includes a large PLE table: 320,001,536 rows, each 160 values wide.

A naïve runtime design reaches for an offset table. At eight bytes per row, that index alone would be roughly 2.38 GiB before allocator and page overhead. It would also solve a problem that does not exist: the rows are fixed-size inside a closed codec profile.

The PLE v1 design uses fixed physical pages and affine arithmetic instead.

## Logical geometry

The sixteen hash heads use cumulative prime-sized segments. Their exact logical end is:

```text
head rows = 320,001,446
```

The checkpoint pads this to a row alignment of 128:

```text
align_up(320,001,446, 128) = 320,001,536
padding rows                         = 90
```

The 90 rows matter. Requiring the prime segments to sum to the padded extent would make the real checkpoint impossible to admit. Treating the trailing rows as arbitrary slack would weaken the identity. The manifest closes both values and the alignment rule.

## Physical geometry

PLE v1 has:

- a fixed 512-byte little-endian manifest header;
- a compact table with one 32-byte SHA-256 digest per page;
- alignment padding before payload;
- fixed-stride physical pages;
- a 64-byte duplicated page header;
- no per-row index.

For row `r`:

```text
page = r / rows_per_page
slot = r % rows_per_page
page_offset = payload_offset + page * page_stride
row_offset  = page_header_bytes + slot * encoded_row_bytes
```

Every multiply, add, alignment, extent, and `off_t` conversion is checked before I/O.

The page header repeats enough geometry to detect a page copied from another store or position: page index, first row, valid row count, logical width, encoded row bytes, rows per page, codec version, codec group size, and family.

## Digest domains

Three digest levels have different jobs:

1. **Manifest digest** — authenticates the header with its own digest field zeroed, the page-digest table, and alignment padding.
2. **Page digest** — authenticates one complete fixed-stride physical page, including its header and unused stride bytes.
3. **Payload digest** — authenticates every complete physical page in order.

Opening the store validates structure and the manifest without reading hundreds of millions of rows. Offline publication runs every page digest and the whole-payload digest.

The test for the final payload comparison is deliberately isolated: mutate payload bytes, recompute the affected page digest and manifest digest, leave the whole-payload digest stale, then require `open` and `verify_page` to pass while `verify_all` fails specifically on the whole payload.

## Transactional row reads

A row read takes one page snapshot.

It does not verify a page and then issue a second direct read for the row. That two-read design creates a time-of-check/time-of-use window: the bytes copied to the caller may not be the bytes that were hashed.

The correct sequence is:

```text
pread complete page into bounded buffer
verify duplicated page header
verify page SHA-256
copy requested encoded row to caller
```

On corruption or short read, the caller's output remains unchanged.

## Atomic publication

The writer uses a sibling temporary file and bounded one-page memory:

```text
create sibling temp
write header, digest table, padding, and pages
fsync temp file
close and reopen through the runtime parser
verify complete payload and boundary pages
fsync parent directory
rename temp over target       <- commit point
fsync parent directory again
```

A failure before rename preserves the old target and removes the temporary file. A post-rename directory-fsync error is reported, but the writer does not attempt an unsafe rollback after the new complete file has become visible.

Deterministic test hooks inject fsync failure before the commit point. Rename failure is tested against a non-replaceable target. Both prove that no apparently valid partial target or sibling temp remains.

## What remains open

The structural format does not pick a production codec.

Codec ID, version, group size, encoded row bytes, rows per page, page alignment, and derived stride belong to a future artifact profile. They need quality, capacity, cold-read, cache, and Metal decode evidence on the target machine.

This separation is intentional. The storage invariants are stable:

- fixed pages;
- affine lookup;
- exact geometry;
- bounded metadata;
- independent verification;
- transactional publication.

The performance choices are not yet stable. Freezing both at once would turn an early benchmark guess into a wire-format promise.
