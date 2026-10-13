# Dataset Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an auditable, non-destructive data manifest that decides which local datasets may train each detector and prevents data leakage before any retraining.

**Architecture:** A new Python data-audit package reads registered raw sources through source-specific adapters and writes only aggregate reports plus manifests without message content. A deterministic normalization/hash layer detects exact duplicates before a source-aware split is assigned. Existing inference and training files remain untouched in this phase.

**Tech Stack:** Python 3, pandas, standard-library `hashlib`/`json`, pytest; existing project virtual environment.

**Spec:** `datasets/README.md` and `datasets/DEVELOPMENT_PROGRESS.md`.

## Global Constraints

- Do not delete, move, alter, or commit any raw dataset during this plan.
- Do not place raw message text, email addresses, URL values, or PII in reports, test fixtures, or Git.
- Treat `TREC-05/06/07` in Seven datasets and MeAJOR as overlapping until the report proves otherwise.
- Keep Grambeddings' provided `test.csv` outside all training.
- Synthetic translations must be tagged and cannot enter validation/test.
- A generic spam label must not be renamed to phishing.

## Review Focus

- CSV values with line breaks must count as one record and never leak into a report.
- An unknown label must be reported and excluded, not silently mapped to benign.
- Two identical normalized bodies from different sources must share one duplicate group.
- Source files absent because a download is unfinished must produce `not_present`, not fail the complete audit.
- No generated report may contain an original text, URL, email address, or phone number.

---

## File Structure

- Create: `python_backend/data_audit/models.py` — typed record and source-summary structures.
- Create: `python_backend/data_audit/adapters.py` — adapters for the currently available source formats.
- Create: `python_backend/data_audit/audit.py` — aggregate-only audit and duplicate calculations.
- Create: `python_backend/data_audit/run_audit.py` — deterministic command-line entry point.
- Create: `python_backend/tests/test_data_audit.py` — synthetic, non-sensitive fixtures and behavior tests.
- Create: `datasets/manifests/.gitkeep` — target directory for generated local manifests; generated files themselves ignored.
- Modify: `.gitignore` — ignore raw data and generated reports while retaining dataset documentation and placeholders.
- Modify: `datasets/DEVELOPMENT_PROGRESS.md` — record D1 only after checks pass.

### Task 1: Define safe source metadata and adapters

**Files:**
- Create: `python_backend/data_audit/models.py`
- Create: `python_backend/data_audit/adapters.py`
- Test: `python_backend/tests/test_data_audit.py`

**Interfaces:**
- Produces `AuditRecord(source_id, channel, raw_label, language, text_for_hash, url_for_hash, is_synthetic)` with no serialization method for raw text or URL.
- Produces `load_source(source_id: str, path: Path) -> Iterable[AuditRecord]`.

- [ ] **Step 1: Write failing adapter tests**

Use temporary CSV fixtures for MeAJOR, Grambeddings and TelePhish. Assert label extraction, channel classification and that a missing path returns a `not_present` source summary.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `python -m pytest python_backend/tests/test_data_audit.py -q`

Expected: FAIL because the adapter package does not exist.

- [ ] **Step 3: Implement the typed record and each adapter**

Adapters must recognize only documented fields, preserve an unknown raw label as unknown, and emit no raw messages to stdout.

- [ ] **Step 4: Run focused tests**

Run: `python -m pytest python_backend/tests/test_data_audit.py -q`

Expected: PASS.

### Task 2: Generate a privacy-safe aggregate audit and duplicate groups

**Files:**
- Create: `python_backend/data_audit/audit.py`
- Modify: `python_backend/tests/test_data_audit.py`

**Interfaces:**
- Consumes `Iterable[AuditRecord]`.
- Produces `AuditReport` containing counts by source/channel/language/raw-label and duplicate-group counts, but no raw content.

- [ ] **Step 1: Write failing report tests**

Assert multiline values count once, an unknown label remains excluded, and equal normalized content from two sources has the same SHA-256 duplicate-group identifier.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `python -m pytest python_backend/tests/test_data_audit.py -q`

Expected: FAIL because audit functions do not exist.

- [ ] **Step 3: Implement `build_audit_report(records) -> AuditReport` and `write_safe_report(report, path) -> None`**

Use stable normalisation for hash input; write only counts, schema metadata, label decisions and irreversible hashes.

- [ ] **Step 4: Run focused tests**

Run: `python -m pytest python_backend/tests/test_data_audit.py -q`

Expected: PASS.

### Task 3: Run the local audit and document inclusion decisions

**Files:**
- Create: `python_backend/data_audit/run_audit.py`
- Create: `datasets/manifests/.gitkeep`
- Modify: `.gitignore`
- Modify: `datasets/DEVELOPMENT_PROGRESS.md`

**Interfaces:**
- Consumes registered local paths and source IDs.
- Produces untracked `datasets/manifests/data_audit.json` and `datasets/manifests/data_audit.csv`.

- [ ] **Step 1: Write a CLI smoke test with a temporary data root**

Assert the command produces reports for available fixtures, marks absent optional sources as `not_present`, and never emits raw fixture text.

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `python -m pytest python_backend/tests/test_data_audit.py -q`

Expected: FAIL because the CLI does not exist.

- [ ] **Step 3: Implement `run_audit.py` and Git ignore rules**

Register Seven raw datasets, MeAJOR, Grambeddings, TelePhish and KarimLulu; explicitly register vectorized Seven files and KarimLulu models as excluded artifacts. Do not execute transformations or overwrite existing artifacts.

- [ ] **Step 4: Run the audit against `datasets/` and inspect only aggregate outputs**

Run: `python python_backend/data_audit/run_audit.py --data-root datasets --output datasets/manifests`

Expected: exit code 0; report identifies TREC/MeAJOR as possible overlap candidates and lists optional unfinished sources as absent.

- [ ] **Step 5: Run all audit tests and update the work log**

Run: `python -m pytest python_backend/tests/test_data_audit.py -q`

Expected: PASS. Then add the D1 evidence, output paths and D2 as the next task to `datasets/DEVELOPMENT_PROGRESS.md`.

## Self-Review

- **Spec coverage:** Tasks 1–3 cover source inventory, label preservation, privacy-safe reporting, overlap detection and the non-destructive D1 decision. Model retraining, UI spans and evaluation are intentionally deferred to D2–D6 in the work log.
- **Step scan:** Each task has one behavior boundary and ends in an executable check.
- **Type consistency:** `AuditRecord` is the only record interface shared by adapters and audit functions; reports accept aggregates only.
- **Review focus:** Adapter, audit and CLI tests pin the five listed failure modes.
- **Proportion:** The plan specifies the data-audit deliverable without prescribing future model implementation.
