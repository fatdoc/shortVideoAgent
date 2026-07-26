# C6 DESIGN QA

- source visual truth: `UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (6).png`
- implementation screenshot: `docs/threads/C6/screenshots/rough-cut-1672x941.png`
- secondary responsive screenshot: `docs/threads/C6/screenshots/rough-cut-1440x900.png`
- viewport: `1672×941` and `1440×900`
- source pixels: `1672×941`
- implementation pixels: `1672×941`
- CSS viewport / density: `1672×941`, device scale factor `1`
- state: unified Demo route, edit tab active, first asset selected, playhead at `00:00`

## Full-view comparison

- Initial evidence: `/tmp/rough-cut-side-by-side.png`
- Initial P1: summary cards pushed the editor below the source fold.
- Initial P1: center region rendered a narrow 9:16 frame instead of a 16:9 preview stage containing a centered 9:16 cut.
- Initial P1: unified placeholder SVGs made the asset grid and preview visibly unlike the supplied restaurant footage.
- Initial P2: column proportions, panel gaps, card density and right-side spacing were looser than the source.
- Fixes: removed the summary row from the first fold, changed columns to `360 / flexible center / 344`, removed inter-panel gaps, rebuilt the preview stage, compressed tracks/cards/panels, and added source-derived presentation assets without changing contract data.
- Post-fix evidence: `docs/threads/C6/screenshots/rough-cut-reference-comparison.png`.
- Final owned-scope result: material filters/cards, center stage/controls/five tracks, and editor tabs/blocks have no remaining actionable P0/P1/P2 mismatch.

## Focused region comparison

- Left material region: two-column cards, thumbnail height, badges, filter rows and selected state checked.
- Center workbench: black stage, portrait cut scale, controls, playhead and five-track density checked.
- Right inspector: tabs, compact blocks, cover ratio, shot matching and QA/export affordances checked.

## Required fidelity surfaces

- Fonts and typography: existing Ant Design Chinese UI typography retained; weights and sizes compressed to source hierarchy.
- Spacing and layout rhythm: source three-column proportions and first-fold workbench rhythm restored.
- Colors and tokens: white editor surfaces, cool-gray dividers, blue active state and dark preview stage matched.
- Image quality and asset fidelity: source-derived restaurant imagery replaces blue placeholder SVGs in this view only.
- Copy and content: workspace-backed names/statuses remain intact; source-like project header and control labels are presentation copy only.

## Comparison history

1. Baseline at `39cff58`: four P1/P2 issues above, result blocked.
2. P0 visual increment: all listed P1/P2 issues addressed and browser evidence captured at both requested viewports.
3. C0 tightened pass: added the missing secondary-filter row, compressed card bodies, and made edit/QA/export tabs switch visible content.

## Browser interaction evidence

- Playback changed from `播放 / 0:00` to `暂停 / 0:04`.
- Timeline clip selection displayed `当前选中片段：门店外景` and `移除片段`.
- Aspect ratio changed from `9:16` to `1:1`, with the preview heading updating in sync.
- QA tab replaced subtitle/BGM editor content with storyboard matching and QA details.
- Export tab displayed the QA-derived missing-shot reasons and a disabled export button.
- Final handoff state restored to edit tab, `9:16`, `0:00`, and no selected clip.
- Browser console: `0 error / 0 warning`.

## Remaining P3

- The global shell differs slightly from the generated reference and is outside C6's allowed edit scope.
- Final case copy/assets should be replaced when C0 expands the unified Demo contract.

final result: passed
