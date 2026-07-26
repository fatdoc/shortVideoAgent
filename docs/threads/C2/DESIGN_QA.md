# C2 Wave 2.5 Design QA

**Final result: passed**

## Comparison target

- Source visual truth:
  - `UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (1).png`
  - `UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (2).png`
- Implementation:
  - `http://127.0.0.1:5173/dashboard`
  - `http://127.0.0.1:5173/projects/new`
- State: unified `demo-local-001` workspace with four explicitly marked local preview cases.
- Source pixels: `1672x941`, RGB, density `1x`.
- Implementation pixels: `1672x941`, CSS viewport `1672x941`, device pixel ratio `1`.
- Responsive evidence: `1440x900` iframe viewport harness, CSS viewport `1440x900`, `clientWidth=1440`, `scrollWidth=1440`.

## Evidence

- Dashboard implementation: `docs/threads/C2/evidence/dashboard-1672x941.png`
- Brief implementation: `docs/threads/C2/evidence/brief-1672x941.png`
- Dashboard responsive: `docs/threads/C2/evidence/dashboard-1440x900.png`
- Brief responsive: `docs/threads/C2/evidence/brief-1440x900.png`
- Dashboard full comparison: `docs/threads/C2/evidence/dashboard-reference-vs-implementation-1672x941.png`
- Brief full comparison: `docs/threads/C2/evidence/brief-reference-vs-implementation-1672x941.png`
- Dashboard main focus: `docs/threads/C2/evidence/dashboard-main-focus-reference-vs-implementation.png`
- Dashboard lower focus: `docs/threads/C2/evidence/dashboard-bottom-focus-reference-vs-implementation.png`
- Brief focus: `docs/threads/C2/evidence/brief-focus-reference-vs-implementation.png`

## Findings

- P0: none.
- P1: none.
- P2: none.
- Accepted differences: global shell branding/navigation is outside C2 scope; enterprise-scale KPI values from the reference are replaced with clearly labeled local demonstration data; weekly charts use existing Demo progress indicators rather than invented production analytics.

## Required fidelity surfaces

- Fonts and typography: existing application typography retained; compact title, label, numeric and helper-text hierarchy matches the reference density without changing global tokens.
- Spacing and layout rhythm: Dashboard now fits five KPI cards, five project rows, four tasks, seven production steps and all three lower data panels in the `1672x941` viewport. Brief keeps five steps, form, assets, diagnosis and CTA in the same viewport.
- Colors and visual tokens: existing blue action color, cyan production states, green readiness states and neutral surfaces retained; no global token change.
- Image quality and asset fidelity: business cards, project rows and material cells use raster thumbnail assets with cover crops; no placeholder boxes or CSS-drawn media.
- Copy and content: local preview cases are explicitly labeled. Brief and Dashboard production flows exclude Brand Brain and use the required script-first sequence.

## Comparison history

- Iteration 1:
  - Finding: Dashboard project title/tools collapsed at the narrower reference-like column width and pushed insights below the viewport.
  - Fix: moved title and filters to two rows, constrained project metadata to one line, and reduced project rows to a compact two-level hierarchy.
  - Post-fix evidence: `dashboard-main-focus-reference-vs-implementation.png`; first project row is `55px`, lower insights start at approximately `y=683`.
- Iteration 2:
  - Finding: Dashboard weekly overview retained a large blank lower half.
  - Fix: added three Ant Design progress trends derived from existing Demo progress, material readiness and C1-C8 fact counts.
  - Post-fix evidence: `dashboard-bottom-focus-reference-vs-implementation.png`; insights bottom is approximately `y=934`.
- Iteration 3:
  - Finding: Brief and Dashboard incorrectly treated Brand Brain as a production step.
  - Fix: Brief now uses `Brief 填写 → 生成脚本 → 分镜与排期 → 素材与预算确认 → 完成创建`; both primary CTAs route to Script. Dashboard uses `Brief → 脚本 → 分镜 → 素材 → 初剪 → 审核 → 导出`.
  - Post-fix evidence: `brief-reference-vs-implementation-1672x941.png` and `dashboard-reference-vs-implementation-1672x941.png`.

## Interaction and runtime checks

- Dashboard local preview selection updates the visible selected case while `demo-local-001` remains the workspace project.
- Dashboard new-project action opens Brief.
- Brief AI suggestion applies to the form.
- Brief top CTA saves when needed and navigates to `/projects/demo-local-001/script`.
- Clean browser session console errors: `0`.
- `1440x900` Dashboard and Brief both report `clientWidth=1440` and `scrollWidth=1440`.

