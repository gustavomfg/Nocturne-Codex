# Nocturne Codex Design System

This document is the visual reference for Nocturne Codex. It applies to the Electron renderer, product documentation, and future desktop surfaces.

## Visual philosophy

Nocturne Codex is a focused engineering workspace, not a marketing website. Its interface should remain quiet during long sessions and make the collaboration state between developer and agent immediately understandable.

The system follows four principles:

1. **Work first.** Content, decisions, source code, and agent state have priority over decoration.
2. **Calm density.** The interface is compact enough for engineering work but never relies on tiny text or cramped targets.
3. **Visible control.** Modes, approvals, errors, and destructive actions must be expressed with text or icons in addition to color.
4. **Nocturne continuity.** Near-black surfaces, restrained violet accents, subtle borders, and low-motion feedback preserve the established identity.

The product philosophy remains the design test for every screen:

> The Nocturne Codex doesn't try to replace the developer. It organizes the collaboration between the developer and AI.

## Typography

Geist Variable is the primary interface typeface. Geist Mono is reserved for code, commands, paths, diffs, logs, keyboard shortcuts, and diagnostic output. Both fonts are bundled with the application and do not require network access.

| Role | Token | Size | Typical weight | Line height | Usage |
| --- | --- | ---: | ---: | ---: | --- |
| Display | `--font-display` | 26 px | 650 | 1.25 | Empty-state and onboarding statements |
| Heading | `--font-heading` | 20 px | 650 | 1.25 | Dialog and major section headings |
| Title | `--font-title` | 16 px | 600–650 | 1.4 | Panel titles, card titles |
| Body | `--font-body` | 14 px | 450 | 1.65 | Interface copy and controls |
| Reading body | — | 15 px | 450 | 1.72 | Assistant responses and Markdown previews |
| Body Small | `--font-small` | 13 px | 450–550 | Secondary interface text |
| Caption | `--font-caption` | 13 px | 450 | Metadata and helper text |
| Label | `--font-label` | 13 px | 600–650 | Form and uppercase section labels |
| Code | `--font-code` | 13 px | 450–500 | Code, diffs, logs, and diagnostics |

Do not introduce text below 13 px. Use color, spacing, and weight to lower emphasis instead of shrinking text. Body copy should normally use weight 450; headings use 600 or 650. Avoid large fields of weight 400 or 700.

## Design tokens

Global tokens live in `src/index.css`. Component styles should consume these tokens instead of adding isolated values.

### Typography tokens

- `--font-sans`, `--font-mono`
- `--font-display`, `--font-heading`, `--font-title`
- `--font-body`, `--font-small`, `--font-caption`, `--font-label`, `--font-code`
- `--leading-tight`, `--leading-ui`, `--leading-body`

### Spacing tokens

The spacing scale is based on a 4 px foundation:

| Token | Value | Use |
| --- | ---: | --- |
| `--spacing-2xs` | 4 px | Inline separation |
| `--spacing-xs` | 6 px | Icon-label and compact internal gaps |
| `--spacing-sm` | 8 px | Control padding and related items |
| `--spacing-md` | 12 px | Default component spacing |
| `--spacing-lg` | 16 px | Card and panel padding |
| `--spacing-xl` | 24 px | Section separation |
| `--spacing-2xl` | 32 px | Message and major block separation |
| `--spacing-3xl` | 48 px | Large content boundaries |

Prefer these values for `gap`, `padding`, and `margin`. A new value is acceptable only when required by alignment or a fixed desktop control dimension.

### Radius and shadow

- `--radius-xs` (5 px): code chips and compact tags.
- `--radius-sm` (7 px): inputs, buttons, icon buttons.
- `--radius-md` (10 px): cards and panel groups.
- `--radius-lg` (14 px): composer and dialogs.
- `--radius-xl` (18 px): expressive brand surfaces only.
- `--shadow-sm`: subtle card separation.
- `--shadow-md`: floating composer and menus.
- `--shadow-lg`: dialogs and previews.

Avoid stacking multiple heavy shadows. Borders create most of the hierarchy in the dark interface.

## Color system

Colors are semantic. Do not use a status color for decoration.

### Surfaces

- `--color-canvas`: application background.
- `--color-panel`: sidebar, inspector, and code surfaces.
- `--color-surface`: cards, inputs, and dialogs.
- `--color-surface-raised`: selected rows and headers.
- `--color-surface-hover`: hover feedback.

### Text

- `--color-text`: primary headings and critical information.
- `--color-text-secondary`: long-form copy and normal labels.
- `--color-text-muted`: supporting text that must remain readable.
- `--color-text-subtle`: placeholders and low-priority metadata.

Do not reduce opacity on body copy. Use the appropriate text token. Primary text should be high contrast; muted text must still be legible during prolonged use.

### Accent and state

- `--color-accent`, `--color-accent-strong`, `--color-accent-surface`: selection, focus, and primary action.
- `--color-success`: completed, connected, or accepted.
- `--color-warning`: planning, waiting, or medium risk.
- `--color-danger`: failed, rejected, or destructive.
- `--color-info`: informational and low-risk states.

Every state needs a text label or recognizable icon. A colored dot alone is insufficient.

## Layout and density

- Sidebar baseline: 280 px, reduced to 250 px on medium windows.
- Inspector baseline: 360 px, reduced to 330 px on medium windows.
- Top bars: 64 px.
- Reading column: maximum 820 px.
- Dialog content should normally remain within 92% of the viewport.
- Standard controls should be at least 32 px high; primary form controls are 36–42 px high.
- Preserve meaningful whitespace between messages, cards, and logical sections.

At narrow widths, the inspector hides before the main reading column becomes uncomfortable. The sidebar remains available as a desktop overlay. No content should require a font-size reduction to fit.

## Component guidance

### Sidebar

Use clear selected-row contrast and a violet edge indicator. Conversation titles are body-sized; timestamps remain readable captions. Destructive row actions may appear on hover, but must also appear on keyboard focus.

### Chat and Markdown

Assistant responses use the highest reading comfort in the product: 15 px with a 1.72 line height. Constrain line length with the 820 px content column. Code blocks use Geist Mono and remain independently scrollable.

### Composer and inputs

The composer is raised through border and modest shadow, not glow. Placeholders use the subtle text token. `focus-within` must remain visible. Send and stop states retain both icon shape and tooltip/context.

### Activity and plans

Use a vertical sequence, consistent 31 px event markers, and explicit labels such as “Em andamento” or “Concluído”. Technical details use a separate code surface and may be collapsed.

### Suggestions and Project Health

Severity uses the left border, category text, and severity label together. Health scores are estimates and must retain their explanatory tooltip or supporting copy. Suggestion cards prioritize title, problem, affected files, decision state, then actions.

### Cards and artifacts

Cards use one border and at most `--shadow-sm`. Hover may lift contrast but should not shift layout. File type is communicated by icon, text, and color.

### Tabs

Tabs use readable labels, a stable height, and an accent underline for selection. Selection may not rely only on text color. Badge counts should not change tab width unexpectedly.

### Dialogs and settings

Dialogs use `--shadow-lg`, a strong border, and restrained backdrop blur. Titles are 16 px or greater. Sections are separated by spacing and subtle borders. Inputs always have visible labels.

### Buttons and badges

- Primary: violet fill, high-contrast text, reserved for the main decision.
- Secondary: surface with visible border.
- Destructive: danger color plus explicit destructive wording or icon.
- Icon-only: minimum 32 × 32 px and a tooltip or accessible name.
- Disabled: reduced contrast is acceptable, but the control must remain identifiable.

### Tooltips

Tooltips explain icon-only actions and unfamiliar state. Keep them concise, place them away from the pointer target, and never put essential workflow instructions only in a tooltip.

### Scrollbars

Scrollbars are 10 px with a transparent track and padded thumb. Nested code/diff regions may scroll independently, but avoid nesting two same-direction scroll regions when possible.

## Motion

Motion communicates state; it is not decoration.

- Standard transitions: 120–180 ms.
- Progress changes: up to 300 ms.
- Loading rotation and streaming caret are acceptable while work is active.
- Avoid large transforms, parallax, continuous ambient animation, and layout-shifting hover effects.
- The global `prefers-reduced-motion` rule removes nonessential duration and repetition.

## Accessibility

- All keyboard-focusable controls use a visible violet focus ring.
- Do not remove outlines unless an equivalent `:focus-visible` treatment is present.
- Information must not depend on color alone.
- Maintain text at 13 px or greater and allow Electron/browser zoom.
- Use semantic buttons, inputs, headings, labels, and dialog structure.
- Icon-only actions require `title`, `aria-label`, or visible supporting text.
- Hover-only actions must also appear on keyboard focus.
- `prefers-contrast: more` increases muted-text and border contrast.
- `prefers-reduced-motion: reduce` is respected globally.

## Adding future screens

1. Start with existing surface, spacing, type, and state tokens.
2. Establish one clear page or dialog title and one primary action.
3. Use the 13 px minimum before testing compact layouts.
4. Check 100%, 125%, and 150% zoom and a window near the supported minimum width.
5. Navigate the entire screen with the keyboard.
6. Verify empty, loading, error, disabled, and long-content states.
7. Confirm state remains understandable in grayscale.
8. Add a new token only when the value is reusable across multiple components.

Visual refinement should make the interface easier to ignore while working. If a treatment attracts more attention than the developer's code, decision, or agent state, reduce it.
