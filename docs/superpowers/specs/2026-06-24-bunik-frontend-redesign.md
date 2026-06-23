# Bunik frontend redesign

## Objective

Apply the visual language and page compositions from `C:\Users\LOQ\Downloads\bunik.dc.html` to the complete existing React frontend while preserving its routes, API integration, authentication, and interactive behavior.

The production application should visually match the reference wherever a corresponding composition exists. Existing features or data states that are absent from the reference will receive new layouts designed in the same visual language.

## Source of truth

- The reference HTML is authoritative for color, typography, line work, card treatment, spacing character, illustration style, and motion.
- Existing React routes, API services, URL behavior, authentication storage, and user workflows are authoritative for functionality.
- The reference's “Sổ tay thiết kế” section is internal documentation and will not appear in production.
- No backend or database behavior is changed by this work.

## Visual system

The application uses a Vietnamese sketchbook aesthetic:

- Paper backgrounds: `#F4EEE1` and `#FBF7EE`.
- Ink: `#2B2722`, with terracotta `#C2603F` as the primary accent.
- Supporting accents: petrol `#2E6A62`, honey `#CE9B4E`, sage `#7E8F5E`, plum `#9B6A78`, rust `#A84B30`, indigo `#4A5A7A`, and brown `#8A7C68`.
- `Shantell Sans` for display headings, `Be Vietnam Pro` for interface and body copy, and `Patrick Hand` for annotations.
- Hand-drawn SVG underlines, doodles, irregular radii, ink borders, offset shadows, paper grain, and restrained page-entry motion.
- Motion must respect `prefers-reduced-motion` and must not delay input or navigation.

Shared tokens and primitives will replace repeated inline declarations where doing so directly improves visual consistency. New abstractions will be limited to components used by more than one screen or required to represent a stable design-system rule.

## Application structure

The current router and page boundaries remain intact. Shared presentation will be implemented through a small set of reusable primitives:

- Application shell: header, responsive navigation, mobile menu, page transition treatment, footer, grain, and shared SVG filters.
- Page heading: handwritten eyebrow, display title, ink underline, optional supporting copy and doodle.
- Surfaces: paper card, outlined card, dashed note, metric tile, status badge, filter chip, and pressable action.
- Feedback: skeleton/loading state, empty state, inline error, and retry action.
- Data visuals: sparklines, progress bars, radar treatment, score trends, and ranking badges using the reference palette.

Existing service calls and page state remain owned by their current pages. The redesign must not duplicate API requests or move interaction state into presentation components.

## Screen mapping

### Shared shell

Match the reference logo, sticky paper navigation, active ink underline, account action, mobile navigation, wavy divider, and ink footer. Navigation remains URL-based and accessible.

### Home

Match the reference hero, search affordance, quick tags, featured universities, score-trend section, doodles, and editorial asymmetry. Search and links continue to route to live result pages.

### Universities and university detail

Match the reference filter chips, sort controls, result cards, ranking markers, metrics, radar presentation, program list, reviews, and compare action. Existing query parameters, API data, comparison selection, review submission, and detail navigation remain functional.

### Majors and major detail

Match the reference category filters, score cards, trend lines, metadata, historical score display, related majors, and university navigation. Additional backend fields will be grouped into sketchbook cards without changing their meaning.

### Rankings and comparison

Match the reference podium, tier colors, hand-drawn table treatment, comparison selectors, highlighted best values, and responsive overflow behavior. Comparison remains driven by selected IDs and live data.

### Major quiz

Match the reference focused question card, progress indicator, answer tiles, recommendation result, and restart action. Quiz scoring behavior remains unchanged.

### Profile and score calculator

Match the reference block selector, numeric inputs, total-score panel, eligibility list, and saved-major cards. Existing profile, awards, achievements, certificates, score calculation, and persistence sections that do not exist in the prototype will use the same card, note, and badge grammar.

### Community ranking

Match the reference tier legend, podium, leaderboard rows, current-user emphasis, and compact mobile presentation while continuing to use API ranking data.

### Authentication and 404

Match the reference paper form, doodle ornament, irregular fields, primary action, mode switch, and guest path. Preserve existing validation, token storage, redirects, and error messaging. The 404 screen will be designed as a minimal sketchbook note using the same shell.

## Responsive and accessibility behavior

- Desktop compositions follow the reference proportions, with a maximum content width near 1200px.
- Tablet layouts reduce decorative density before reducing content density.
- Mobile layouts become single-column, keep controls at least 44px high, preserve readable table alternatives or horizontal scrolling, and avoid clipped decorations.
- Keyboard focus is visible and uses the terracotta/ink system.
- Semantic headings, form labels, button types, link behavior, and meaningful SVG labels are preserved or improved.
- Color is never the only carrier of selection, error, success, or ranking state.

## Data, loading, and errors

- API contracts in `services/api.ts` and route contracts in `routes.tsx` remain unchanged unless a confirmed existing defect blocks the requested design.
- Loading states use stable skeleton geometry to avoid layout shift.
- Empty states explain what is missing and retain relevant reset/retry actions.
- API errors are shown in styled inline notices; existing fallback mock data is preserved only where already intended by the current implementation.
- Independent requests should remain parallel and no new request waterfalls will be introduced.

## Verification

The redesign is complete when:

1. Every existing route renders in the reference visual language at desktop and mobile widths.
2. `npm run typecheck` succeeds.
3. `npm run build` succeeds.
4. Browser checks cover navigation, mobile menu, authentication mode and submission, university/major filtering, detail navigation, comparison, quiz completion/reset, score calculation, and ranking views.
5. Browser console checks show no new runtime errors.
6. Visual inspection confirms that corresponding reference compositions are closely matched and that supplemental compositions feel native to the same design system.

## Scope controls

- Do not change backend or database code.
- Do not add product features that are not already present.
- Do not replace the router or API layer.
- Do not perform unrelated cleanup or broad dependency migration.
- Remove only imports, variables, or styles made obsolete by this redesign.
