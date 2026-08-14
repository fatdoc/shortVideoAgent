# CV6 final full-case external browser Gate

## Verdict

`SAFE_FULL_CASE_NO_PROVIDER_PASS` for integration
`c218526e995ecfb941d636408b6ad1c3fa577596`.

This is not the paid-provider Golden Path. Seedance and all paid Provider configuration stayed absent;
Canvas acceptance is the contractually truthful hydrated blocked-readiness state.

## Git provenance

- final integration: `c218526e995ecfb941d636408b6ad1c3fa577596`
- QA integration merge: `3e132f00901062aa51ed9ff9ccdbad51f4b8b301`
- merge parents: `a52db2ebafa6d27fb52a54b19dcc03cdbc06e4fa` and
  `c218526e995ecfb941d636408b6ad1c3fa577596`
- integration parent pair: `64be229e5780aca2f042bd6cb387f5323542f3ae` and
  `cdf1121d5a6b3e93e8a3c4a3da5072ad40588e58` (Channel invitation parser remediation)

## Live services retained for manual verification

| Surface | URL | Listener PID | Result |
| --- | --- | ---: | --- |
| Control API | `http://127.0.0.1:10600` | 36714 | ready 200, version `c218526e…` |
| StoryCanvas | `http://127.0.0.1:10588` | 36717 | capability 200, no Provider |
| Pilot Vite | `http://127.0.0.1:5173` | 36718 | login 200 |

The supervisor is the tmux session `cv6-final-full-case`. The canonical Canvas URL is:

`http://127.0.0.1:5173/production/canvas/00b4826e-d2d9-58ca-9f88-999bc1013ccb?packageId=366f7983-0c30-4017-ac71-3a0ef73311ce`

The four existing accounts are `platform@videoagent.test`, `channel@videoagent.test`,
`admin@videoagent.test`, and `operator@videoagent.test`. The credential is deliberately omitted from
all committed evidence and logs.

## External browser matrix

Microsoft Edge was selected by an explicit absolute executable path because the installed Playwright
package's matching bundled Chromium was absent. The first launch-only environment RED made no product
requests. The final run passed 8/8 cases with one worker.

| Account | Real surfaces verified at both viewports | Project/Canvas disposition |
| --- | --- | --- |
| platform_admin | revoked invitation, members, draft Terms, commission true-empty | tenant project route safely not found |
| channel_admin | revoked channel invitation, members, commission true-empty | tenant project route safely not found |
| tenant_admin | Dashboard, Products, Project, Brand, Brief, Script, Storyboard, Production, revoked invitation, members, recharge true-empty, Canvas | full real case; hydrated no-provider readiness blocked; reload stable |
| content_operator | Project, Brand, Script with Brief continuity, Storyboard, Production, Canvas; five tenant-admin surfaces denied | no Brief mutation; hydrated no-provider readiness blocked; reload stable |

Both viewports were exact `1440x900` and `1672x941`. The final output contains 68 success screenshots
and zero `error-context.md` or `test-failed-*.png` files.

Canvas's exact observed chain on both tenant roles and both viewports, including reload, was:

1. safe CSRF acquisition / Canvas assets: 200;
2. activation: 201 then StrictMode replay 200;
3. legacy bootstrap open: 200 then exact replay 200;
4. formal bootstrap: 200 then exact replay 200;
5. workspace: 200 then exact replay 200;
6. real workspace hydration, visible project/script/storyboard/assets;
7. `Seedance 能力当前不可用`, generate button disabled.

Approval requests, Canvas command requests, external browser requests and paid-provider calls were all
zero. DOM, URL, Local/Session Storage and console values passed the forbidden-value scan.

## Seed and environment truth

The first Canvas diagnostic returned activation 404 because the short-lived ProjectGrant had expired
and the initial coordinator pointed Story at its generic default root. No product assertion was
weakened. The final coordinator binds both services to the frozen local-case Story root and Control
asset root.

The official additive/idempotent local-case runner refreshed the 15-minute grant. Protected before and
after counts were identical: users 9, organizations 3, memberships 9, projects 2, Brief/Script/
Storyboard/Package each 1, invitations 3, Terms document/version 1; all eleven commerce tables stayed
zero. It reported one active grant, `providerConfigured=false`, and `paidProviderCalls=0`.

For later manual testing, refresh the short TTL with the checked-in
`scripts/t0-canvas-v1-gate/refresh-final-full-case-seed.ts` runner and pass the account password only in
the process environment. Never write the password into evidence or logs.

## Regression results

- final browser policy: 8/8 PASS
- final external browser: 8/8 PASS
- Shared focused final surfaces: 85/85 PASS
- Shared full suite: 545/545 PASS
- Control full suite: 567 PASS, 245 environment-gated skips
- Story Canvas targeted: 75/75 PASS
- root, Control and Story builds: PASS
- governance: PASS
- protected local-case counts: unchanged
- generated Story build artifact: restored; no product file remains modified

## Evidence

- `docs/program/t0-canvas-v1/evidence/full-case-visibility/summary.json`
- `docs/program/t0-canvas-v1/evidence/full-case-visibility/services.json`
- `docs/program/t0-canvas-v1/evidence/full-case-visibility/seed-refresh.json`
- `docs/program/t0-canvas-v1/evidence/full-case-visibility/playwright/`

## Recommendation

Accept the final non-paid full-case browser slice. Keep the overall paid Golden Path explicitly pending;
no real Seedance task was dispatched in this Gate.
