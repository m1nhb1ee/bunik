# Profile Tier Card Design

## Goal

Adjust the right-hand academic-score area on `HoSoPage` so it visually aligns with the `BXH` page without changing profile logic, data flow, or save behavior.

## Scope

The change is limited to the right column of the profile page:

- keep the existing academic-score card as the primary surface;
- add a `Tier` cluster on the right side of that card, using the same tier language as `BXH`;
- remove the separate `Thành phần khác của hồ sơ` summary card entirely.

No backend, API, database, ranking, or score-formula changes are part of this work.

## UI structure

### Academic score card

The existing `Điểm học lực 8 môn` card remains the main card. Its internal layout becomes a two-column header area:

- left: current score title, large `/80` value, and completion status pill;
- right: a compact `Tier` cluster.

The four existing stat tiles below the header remain in place.

### Tier cluster

The new cluster contains:

- a small uppercase `Tier` label;
- a large tier badge;
- a short range caption under the badge.

The badge styling must match the visual language already used in `BXH`:

- same tier letters: `S`, `A`, `B`, `C`, `D`, `E`, `F`;
- same color mapping per tier;
- same hand-drawn rounded badge shape family;
- same typography direction as the ranking page.

The range caption is informative only. It reflects the same score bands already defined for `BXH`.

## Tier mapping

The academic score already displayed in the card is the only source of truth for tier selection.

Use the same score bands already present on `BXH`:

- `S`: `150+`
- `A`: `100–149`
- `B`: `90–99`
- `C`: `75–89`
- `D`: `60–74`
- `E`: `45–59`
- `F`: `0–44`

This UI work does not redefine those bands. It only reuses them for consistent presentation inside the profile page, even if current profile scores on `/80` make the upper bands unreachable today.

## Removed UI

Delete the entire `Thành phần khác của hồ sơ` card from the right column.

This removes only the duplicated summary text. The underlying profile inputs for special-subject score, achievements, and certificates remain unchanged and continue to save exactly as before.

## Behavior

- Do not change `scorePreview` calculation.
- Do not change subject completeness logic.
- Do not change achievement or certificate persistence.
- Do not add new API calls.
- Do not move the existing radar chart or achievement sections unless required by natural vertical reflow after the removed card.

## Responsive behavior

On large screens, the score-and-tier header uses a left/right split inside the existing card.

On smaller screens, the tier cluster stacks under or beside the score area as needed, but it remains part of the same card and must not create horizontal overflow.

## Implementation notes

- Prefer extracting the tier color/range mapping into a small page-local constant or shared helper only if the reuse is direct and minimal.
- Keep the change surgical inside `HoSoPage`; avoid unrelated refactors.
- Preserve the current sketchbook tokens and card styling already used on the page.

## Verification

1. `HoSoPage` renders the new tier cluster inside the academic-score card.
2. The tier badge color and label match the band rules used on `BXH`.
3. The `Thành phần khác của hồ sơ` card no longer renders.
4. Existing score display, completion status, radar chart, achievements, and save actions still behave unchanged.
5. Frontend typecheck and build pass.

## Out of scope

- changing tier thresholds;
- changing academic-score formula or `/80` scale;
- changing ranking logic;
- changing any backend contract;
- redesigning the rest of the profile page.
