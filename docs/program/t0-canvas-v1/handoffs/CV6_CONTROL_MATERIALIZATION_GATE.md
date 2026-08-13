# CV6 Control Materialization independent gate

> Task: `T0-CV1 / Control CanvasAssetMaterialization/0.1`
>
> Revalidated integration head: `1ef4bf939dfdbeb5639c08440ea4a339aeee80f5`
>
> CV6 recommendation: `ACCEPT / READY_FOR_GATE`

This is an independent QA recommendation for the Control materialization
implementation. It does not edit the Master Plan or contracts and does not
declare a Gate accepted. CV0 alone owns the Gate decision.

## Isolation and provenance

CV6 ran with `gpt-5.6-sol` and `high` reasoning in a clean independent line:

```text
worktree: /Users/docfat/.codex/worktrees/t0-cv1-cv6-control-materialization-gate
branch:   codex/t0-cv1-cv6-control-materialization-gate
baseline: ee148b4b0bf589beeb183f1b3667c5ffb5ab6eb9
```

All upstream intake used normal merge commits. No rebase, reset, cherry-pick
or manual product copy was used.

```text
42334b19fa17e3701cb9fd7e9d866efed82e738f
  parent 1: ee148b4b0bf589beeb183f1b3667c5ffb5ab6eb9
  parent 2: 30cc092cb82874abf47ce6871594009e7162a289

11562f4f7d6be37a3ae9cdf1063d8c9f7b52d8f4
  parent 1: 9bd3ece8864de82dfd6764b2db80eb1c82758f82
  parent 2: 0f4aecfb19e0af15ce06544f062a012fff2e8382

349eb03a691ec6fbda2509d06098b7effe06316e
  parent 1: 11562f4f7d6be37a3ae9cdf1063d8c9f7b52d8f4
  parent 2: 1ef4bf939dfdbeb5639c08440ea4a339aeee80f5
```

The add/add conflicts in the middle merge were limited to three upstream
product files independently added on both histories. CV6 resolved each to the
exact integration-parent blob and verified its object hash. Merge diffs are
upstream integration content and are excluded from the CV6 write set.

## Independent REDs and remediation

CV6 found and reported two product regressions before the final run:

1. The original Control parser applied a single large regular expression to an
   exactly allowed 8 MiB base64 value and raised an uncaught `RangeError`.
   CV5 replaced that path with bounded validation in product final
   `f3b6002fbf64e01140b433d1d48e722fff2a6413`.
2. Migration 027 raised the deterministic reset/seed summary from 26 to 27,
   while `resetSeed.test.ts` still required 26. CV5 corrected that exact
   assertion in `75d03d1895416faca5e422bbffef00d281132415`.

Both failures were reproduced on the dedicated test database before the
remediations and passed after normal merges of their integrated descendants.
CV6 did not modify product code.

## Independent materialization evidence

The final gate ran with exactly:

```bash
CONTROL_API_TEST_DATABASE_URL=postgresql://localhost/videoagent_control_test \
CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent \
  node scripts/t0-canvas-v1-gate/run-control-materialization-gate.mjs
```

Before every destructive reset, CV6 queried PostgreSQL and required
`current_database() = videoagent_control_test`. The non-test Control database
was never addressed.

```text
static product/migration/security policy:      5/5 PASS
CV6 unit/HTTP/storage/service/PostgreSQL:       5/5 PASS
CV5 owner materialization targeted:            35/35 PASS
CV5 owner PostgreSQL repository:                1 PASS / 1 owner inverse skip
migration chain through 027:                    1/1 PASS
CONTROL_MATERIALIZATION_GATE_PASS
```

The independent checks establish:

- internal authentication runs before the private JSON parser; the route has
  an exact 16 KiB body limit, `no-store`, fixed safe codes and no body echo;
- exact active session, project/package/tenant scope, approved asset rights,
  read authorization and storage source are checked before reading bytes;
- traversal, schemes, root escape, final symlink and intermediate symlink are
  rejected; the local reader uses containment plus no-follow semantics;
- a minimum three-byte JPEG passes with exact MIME, byte count, SHA-256 and
  canonical base64 facts; one byte fails fixed `MIME_UNSUPPORTED`;
- an exactly 8 MiB valid JPEG passes without stack overflow, while 8 MiB + 1,
  malformed and noncanonical inputs fail with stable codes and no uncaught
  exception;
- same request/same scope replays the persisted materialization across a fresh
  repository instance; changed scope conflicts;
- migration 027 is registered, scope-bound and immutable, and persists no raw
  bytes, base64, local path, storage credential or token.

The PostgreSQL test executes the real migration, creates through one repository
instance, reopens through a second instance to simulate restart, verifies
replay/conflict, inspects the exact stored columns and proves immutable update
and delete triggers.

## Full regression and protected evidence

After the final integrated remediation, CV6 reset only the dedicated database
and ran the complete Control suite serially with one worker:

```text
Control test files:                            99/99 PASS
Control tests:                                 776 PASS / 3 existing skips
Control API build:                             PASS
Control API typecheck:                         PASS
Governance validation:                         PASS
git diff --check:                              PASS
```

The three skips are existing owner inverse/environment guards; every required
CV6 independent test is checked to contain no `skip`, `only` or `todo`.

Protected comparison against
`1ef4bf939dfdbeb5639c08440ea4a339aeee80f5` shows no CV6 change to product,
migrations, contracts, Master Plan, `byteplus.ts` or Shared files. The product
lineage contains exactly the reviewed 21 Control paths, including migration
027 and its repository, service, storage, parser, internal route and tests.

## Exact CV6 write set

Independent test commit before this handoff:

```text
9bd3ece8864de82dfd6764b2db80eb1c82758f82  test(canvas-v1): freeze control materialization gate
```

Exact CV6 paths relative to the final integration head:

```text
scripts/t0-canvas-v1-gate/run-control-materialization-gate.mjs
scripts/t0-canvas-v1-gate/vitest.control-materialization.config.mjs
tests/e2e/canvas-v1/control-materialization-policy.gate.mjs
tests/e2e/canvas-v1/control-materialization-postgres.gate.test.ts
tests/e2e/canvas-v1/control-materialization.gate.test.ts
docs/program/t0-canvas-v1/handoffs/CV6_CONTROL_MATERIALIZATION_GATE.md
```

## Recommendation and non-claims

CV6 recommends `ACCEPT` for this Control Materialization implementation and
reports `READY_FOR_GATE` for CV0 verification. CV0 should independently verify
the commit objects, merge parents, exact paths and commands before recording a
Gate decision.

No real paid Seedance call was made. This Gate does not claim the downstream
Story/Shared browser Golden Path, a Provider task, G6 completion, Canvas V1
completion, AB Golden Path completion or Joint Gate acceptance.
