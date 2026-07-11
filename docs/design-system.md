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

- Sidebar baseline: 300 px, reduced to 270 px and then 250 px on medium windows.
- Inspector baseline: 390 px, reduced to 350 px and then 320 px on medium windows.
- Top bars: 64 px.
- Reading column: maximum 840 px.
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

## Component scale

Component dimensions use named tokens so similar controls keep the same rhythm:

| Token | Size | Typical use |
| --- | ---: | --- |
| `--control-sm` | 32 px | Icon buttons, compact secondary actions |
| `--control-md` | 38 px | Inputs, standard buttons, selectors |
| `--control-lg` | 44 px | Primary navigation and prominent actions |
| `--sidebar-width` | 300 px | Conversation and workspace navigation |
| `--inspector-width` | 390 px | Agent activity, plan, suggestions, artifacts |
| `--content-width` | 840 px | Chat, composer, modes, and quick actions |

Controls may be taller when content requires it, but they should not be shorter than the closest scale token. Icon-only controls remain square. Pills derive height from `--control-sm` and use horizontal padding from the spacing scale.

## Desktop grid

The visual grid uses `--grid-unit: 4px`. Most dimensions and offsets should resolve to multiples of 4; the 6 px spacing token is reserved for close icon-label relationships.

The desktop shell has three regions:

```text
┌──────────────────┬──────────────────────────────┬──────────────────────┐
│ Sidebar 300 px   │ Flexible work area           │ Inspector 390 px     │
│ navigation       │ content max 840 px           │ agent context        │
└──────────────────┴──────────────────────────────┴──────────────────────┘
```

- At widths below 1320 px, navigation and inspector contract before content typography changes.
- At widths below 1120 px, secondary inspector icons may be hidden while labels remain.
- At compact desktop widths, the inspector hides before the reading column becomes cramped.
- Layout never solves width pressure by reducing the type scale.

## Premium component treatment

### Navigation

The sidebar has additional horizontal breathing room and a 50 px brand area. Conversations use 52 px rows with stable icon geometry. The selected row combines a subtle violet edge, low-contrast gradient, icon surface, and text contrast; selection never depends on color alone. Workspace rows use the same radius and interaction timing as conversations.

### Agent inspector

The wider inspector accommodates readable labels, status badges, code details, and action groups without premature wrapping. Its header, tabs, and scroll area establish three clear horizontal layers. Timeline markers, cards, diffs, Git, and exports share consistent spacing and border rhythm.

### Home actions

Home cards use a 96 px minimum height, 18 px padding, a dedicated icon surface, 15 px title, and one-pixel hover lift. Their presence comes from composition and whitespace rather than saturation or large shadows.

### Primary composer

The composer has a 72 px initial writing area and may grow to 220 px. The caret uses the accent color, placeholder contrast remains readable, and the focused surface changes only slightly. The send action uses restrained elevation; stop removes that elevation to feel controlled rather than promotional.

### Badges and status

Modes, connection state, branch, workspace, and compact metadata share pill geometry, readable 13 px type, and 30–34 px height. State badges combine label, dot, border, foreground, and background:

- ready/completed: green semantic surface;
- running/starting: violet semantic surface;
- planning/waiting/cancelling: amber semantic surface;
- failed: red semantic surface;
- disconnected: neutral semantic surface.

Counters use a contained surface and border so they remain distinguishable from labels.

## Motion scale

| Token | Duration | Use |
| --- | ---: | --- |
| `--motion-fast` | 120 ms | Hover, color, border, and button feedback |
| `--motion-base` | 160 ms | Focus, surfaces, dialogs, and state transitions |
| `--motion-slow` | 240 ms | Progress or larger contextual changes |

All standard transitions use `--ease-standard`, a restrained ease-out curve. Pressed controls move down by no more than 1 px. Home cards may lift by 1 px on hover. Dialog entrance uses 3 px translation and less than one percent scale change. Reduced-motion preferences collapse these durations globally.

## Desktop guidelines

- Optimize for repeated use, not a first-impression animation.
- Keep the work surface visually quieter than navigation and agent state.
- Contract chrome before compressing text or controls.
- Use elevation only to explain layering: composer, menu, dialog, preview.
- Prefer separators and spacing over multiple nested card backgrounds.
- Keep primary actions scarce; a section should rarely contain more than one filled button.
- Preserve stable positions for navigation, send/stop, approvals, and dialog dismissal.
- Test long project names, long responses, multiple activities, empty panels, and active approvals.
- At 125% and 150% zoom, protect the chat column before peripheral panels.
- Never make a desktop interface denser solely because more horizontal space exists.

## UX review — Phase 5.2

This review evaluates the current interface as a first-time user. It documents observations only; the remaining suggestions are not part of Phase 5.2 implementation.

### Strengths

- The three-part desktop layout immediately communicates navigation, work, and agent context.
- The Nocturne palette is calm and consistent without reducing code or response readability.
- Build, Review, and Docs remain visible near the composer, keeping agent authority understandable.
- Agent activity, plans, suggestions, and artifacts use a shared panel structure and predictable tabs.
- Empty states explain what will appear instead of presenting blank surfaces.
- The composer is visually stable and comfortable enough for longer prompts.
- Approval, failure, connection, and execution states use redundant visual cues.
- Geist and the 13 px floor significantly improve prolonged reading compared with the prototype density.

### Small remaining inconsistencies

- Some legacy CSS declarations remain below the design-system layer even though they are overridden by the current tokens. Consolidating them would improve stylesheet maintainability, but would be a refactor outside this visual-only phase.
- A few icon sizes are defined directly in JSX. They align visually, but future work should map icon sizes to explicit component primitives.
- Native `title` tooltips depend on the operating system and do not have the same timing or surface as the application.
- Dialog semantics and focus trapping are not uniform across every modal; addressing that requires behavioral work rather than visual styling.
- Project Health explanations currently rely primarily on hover titles in the compact card layout.

### Future suggestions — not implemented

- Create small internal primitives for Button, IconButton, Badge, Tooltip, and Dialog to enforce the documented scale automatically.
- Add a visual regression suite covering the main desktop widths and 100%, 125%, and 150% zoom.
- Add a non-blocking command palette preview only if it becomes part of an approved product phase.
- Standardize focus trapping and initial focus for every modal.
- Provide a compact, visible explanation affordance for each Project Health metric.
- Validate the palette with automated contrast tooling as part of CI.

The interface now gives the developer's work the strongest visual weight. Navigation and agent context remain available, but their motion, elevation, and saturation stay deliberately restrained.
