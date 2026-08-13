# CV6 Control Workspace Authority independent gate

> Task: `T0-CV1 / Control CanvasWorkspace Authority/0.1`
>
> Integrated baseline: `81da90f508c136b87d2d9c28a1edd06fe95f350e`
>
> CV6 recommendation: `ACCEPT / READY_FOR_GATE`

This is an independent QA recommendation. It does not edit the Master Plan or
contracts and does not declare a Gate accepted; CV0 owns the Gate decision.

## Isolation and provenance

CV6 ran with `gpt-5.6-sol` and `high` reasoning in a clean independent line:

```text
worktree: /Users/docfat/.codex/worktrees/t0-cv1-cv6-control-workspace-authority-gate
branch:   codex/t0-cv1-cv6-control-workspace-authority-gate
baseline: 81da90f508c136b87d2d9c28a1edd06fe95f350e
```

The branch was created directly at the exact requested integration baseline,
which already contains owner product commit `ace4819`. No upstream merge was
needed on this QA line, and no rebase, reset, cherry-pick or manual product copy
was used. The independent test commit has this exact parent:

```text
1ee6fc66a468316874e3c5ef985cea4b71c5af9f
  parent: 81da90f508c136b87d2d9c28a1edd06fe95f350e
```

Owner commit `ace4819` has exactly these eleven paths:

```text
apps/control-api/src/app.ts
apps/control-api/src/assets/internalWorkspaceAuthorityRoutes.test.ts
apps/control-api/src/assets/internalWorkspaceAuthorityRoutes.ts
apps/control-api/src/assets/workspaceAuthorityErrors.ts
apps/control-api/src/assets/workspaceAuthorityParser.test.ts
apps/control-api/src/assets/workspaceAuthorityParser.ts
apps/control-api/src/assets/workspaceAuthorityService.test.ts
apps/control-api/src/assets/workspaceAuthorityService.ts
apps/control-api/src/assets/workspaceAuthorityTypes.ts
apps/control-api/src/production/workspaceAuthorityRepository.ts
apps/control-api/src/server.ts
```

## Independent authority evidence

The final gate ran with exactly:

```bash
CONTROL_API_TEST_DATABASE_URL=postgresql://localhost/videoagent_control_test \
CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent \
  node scripts/t0-canvas-v1-gate/run-control-workspace-authority-gate.mjs
```

CV6 confirmed the database name as exactly `videoagent_control_test` before
the PostgreSQL gate and the full serial Control run. No non-test database was
addressed.

```text
Workspace Authority contract validator:       30 vectors / 6 groups PASS
CV6 static product/security policy:            5/5 PASS
CV6 HTTP/service/PostgreSQL tests:              6/6 PASS
owner targeted files:                          4/4 PASS, 16/16 tests PASS
owner PostgreSQL repository:                   1 PASS / 1 existing inverse skip
CONTROL_WORKSPACE_AUTHORITY_GATE_PASS
```

The independent checks establish:

- internal token authentication runs before parsing; the private route has an
  exact 16 KiB limit, fixed safe `no-store` errors and no token/body echo;
- the exact active five-field session scope is checked before all production
  and asset reads, and a rejected session causes zero downstream dispatch;
- Package-bound script and storyboard IDs are read exactly, with numeric
  versions and the real `projectName`; later version rows cannot replace them;
- the complete safe `AssetRecord` projection is sorted deterministically by
  category and asset UUID, while storage/checksum/provider/byte/token/package
  authority facts are absent;
- one virtual-character casting is required, including a unique pending record;
  zero or multiple castings fail closed without returning a partial aggregate;
- the repository uses a repeatable-read, read-only transaction and exact
  Package IDs, with no latest/current selector and no write interface;
- neither the route, service nor repository writes or logs raw dependency data.

The dedicated PostgreSQL test also inserted higher numeric script/storyboard
versions and proved that the exact Package IDs still resolve to versions 3 and
2, while preserving all rows.

## Full regression and protected evidence

After the independent gate, CV6 ran the complete Control suite serially with
one worker against the dedicated database:

```text
Control test files:                            103/103 PASS
Control tests:                                 790 PASS / 4 existing skips
Control API build:                             PASS
Control API typecheck:                         PASS
Governance validation:                         PASS
git diff --check:                              PASS
```

Every required CV6 test is statically checked to contain no `skip`, `only` or
`todo`. Protected comparison against the requested baseline shows no CV6 change
to product code, migrations, contracts, Master Plan, `byteplus.ts` or Shared
files.

## Exact CV6 write set

Independent test commit:

```text
1ee6fc66a468316874e3c5ef985cea4b71c5af9f  test(canvas-v1): freeze control workspace authority gate
```

Exact CV6 paths:

```text
scripts/t0-canvas-v1-gate/run-control-workspace-authority-gate.mjs
scripts/t0-canvas-v1-gate/vitest.control-workspace-authority.config.mjs
tests/e2e/canvas-v1/control-workspace-authority-policy.gate.mjs
tests/e2e/canvas-v1/control-workspace-authority-postgres.gate.test.ts
tests/e2e/canvas-v1/control-workspace-authority.gate.test.ts
docs/program/t0-canvas-v1/handoffs/CV6_CONTROL_WORKSPACE_AUTHORITY_GATE.md
```

## Recommendation and non-claims

CV6 recommends `ACCEPT` for the Control Workspace Authority implementation and
reports `READY_FOR_GATE` for CV0 verification. CV0 should independently verify
the commit objects, exact paths and commands before recording a Gate decision.

No paid Seedance call was made. This result does not claim Story G5 completion,
the browser Golden Path, G6 completion, Canvas V1 completion, AB Golden Path
completion or Joint Gate acceptance.
