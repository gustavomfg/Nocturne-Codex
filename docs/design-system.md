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

## Visual Identity

The definitive identity is the Nocturne crescent: a violet orbital disc interrupted by a dark crescent, supported by two quiet stars and a pale horizon accent. It represents focused work during the hours when distractions disappear, without using literal robot or chat imagery.

Canonical assets live in `assets/`:

- `logo/nocturne-mark.svg`: primary square mark;
- `logo/nocturne-mark-dark.svg`: separated dark-surface treatment;
- `logo/nocturne-mark-monochrome.svg`: constrained single-color use;
- `logo/nocturne-logo.svg`: horizontal wordmark;
- `icons/nocturne-32.png`, `nocturne-128.png`, and `nocturne-512.png`: small, medium, and large raster sizes;
- `icons/favicon.png`, `electron.png`, and `github.png`: platform-specific exports.

The mark must retain its geometry, dark base, and restrained violet gradient. Do not rotate, skew, add glow, replace the gradient with saturated colors, or separate its stars from the crescent. Clear space equals at least one eighth of the mark width. The interface uses the mark without accompanying animation.

### Icons

Interface icons use Lucide with consistent optical sizing: 12–14 px inside compact metadata, 15–18 px in controls, and 20–30 px only in empty or welcome states. Icon-only controls require an accessible name and tooltip. Icons inherit semantic foreground color; they do not introduce unrelated colors or filled illustration styles.

## Interaction Philosophy

Every interactive element should acknowledge the user's intention.

Hover should invite.

Click should confirm.

Motion should preserve continuity.

Feedback should build confidence.

If the user wonders whether something is clickable, the interface has failed.

If the user notices the animation, it is probably too much.

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

Global tokens live in `src/styles/tokens.css`. Component styles should consume these tokens instead of adding isolated values. Typography is defined in `src/styles/typography.css`, shared motion in `src/styles/motion.css`, and global browser/Electron defaults in `src/styles/globals.css`.

The component cascade is composed by `src/styles/components.css` in a fixed order: shell and chat, inspector and Git surfaces, workflows and overlays, the consolidated product theme, then responsive and interaction polish. Keep new rules in the narrowest matching module and preserve this import order so late refinements remain intentional.

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

### Canonical breakpoints

- 1320 px: reduce the desktop panel widths;
- 1120 px: use the compact desktop panel density;
- 980 px: convert sidebar and inspector into mutually exclusive off-canvas dialogs;
- 720 px: compact the topbar, composer, settings navigation, and secondary labels;
- 520 px: preserve only essential topbar actions and single-column remediation.

Do not add an intermediate breakpoint without documenting a layout failure that cannot be solved by flexible sizing. Responsive behavior must use semantic classes rather than DOM position selectors. At 980 px and below, only one lateral panel may be open, focus stays inside it, Escape closes it, and focus returns to its trigger.

`npm run lint:design` enforces the 13 px typography floor and the canonical breakpoint set so legacy values cannot silently return to the cascade.

## Component guidance

### Sidebar

Use clear selected-row contrast and a violet edge indicator. Conversation titles are body-sized; timestamps remain readable captions. Destructive row actions may appear on hover, but must also appear on keyboard focus.

### Chat and Markdown

Assistant responses use the highest reading comfort in the product: 15 px with a 1.72 line height. Constrain line length with the 820 px content column. Code blocks use Geist Mono and remain independently scrollable.

### Composer and inputs

The composer is raised through border and modest shadow, not glow. Placeholders use the subtle text token. `focus-within` must remain visible. Send and stop states retain both icon shape and tooltip/context. The prompt field grows with its content up to 220 px and only then introduces internal scrolling.

### Activity and plans

Use a vertical sequence, consistent 31 px event markers, and explicit labels such as “Em andamento” or “Concluído”. Technical details use a separate code surface and may be collapsed.

### Suggestions and Project Health

Severity uses the left border, category text, and severity label together. Health scores are estimates and must retain their explanatory tooltip or supporting copy. Suggestion cards prioritize title, problem, affected files, decision state, then actions.

When persisted suggestion state changes a health dimension, the affected metric shows its previous and current score for a short interval and announces the recalculation through a polite live region. All six dimensions follow the same behavior. Scores are always recomputed from open suggestions after persistence; the interface never increments a metric optimistically.

### Cards and artifacts

Cards use one border and at most `--shadow-sm`. Hover may lift contrast but should not shift layout. File type is communicated by icon, text, and color.

### Tabs

Tabs use readable labels, a stable height, and an accent underline for selection. Selection may not rely only on text color. Badge counts should not change tab width unexpectedly.

### Dialogs and settings

Dialogs use `--shadow-lg`, a strong border, and restrained backdrop blur. Titles are 16 px or greater. Sections are separated by spacing and subtle borders. Inputs always have visible labels.

Provider settings use a single-column list of bounded cards and one editor at a
time. Source, endpoint, credential state and availability remain textual; icon
color alone never communicates connection state. Password fields use one
focus-within boundary, drafts state that no network request occurs, and enabled
submissions state that validation will run. Unsaved Provider edits prevent
silent navigation away.

### Segundo Cérebro

The memory dialog separates capture from review on desktop and uses explicit Library and Create tabs at 720 px and below. Confidence, origin, scope, and lifecycle state remain legible without competing with memory content; pending candidates retain a visible review count. Human approval is stated in the header and new entries remain visually identified as candidates until activation. Loading, empty, filtered, editing, disabled, and destructive states must preserve the same dialog geometry and keyboard behavior.

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
| `--motion-card` | 140 ms | Cards and repeated rows |
| `--motion-tab` | 150 ms | Tab indicator and content fade |
| `--motion-base` | 160 ms | Focus, surfaces, and state transitions |
| `--motion-panel` | 180 ms | Both sidebars and panel geometry |
| `--motion-dialog` | 140 ms | Dialog surfaces |
| `--motion-slow` | 240 ms | Progress or exceptional contextual changes |

All standard transitions use `--ease-standard`, a restrained ease-out curve. Pressed controls move down by no more than 1 px. Home cards may lift by 1 px on hover. Dialog entrance uses 3 px translation and less than one percent scale change. Reduced-motion preferences collapse these durations globally.

## Motion Design

Motion in Nocturne Codex exists to preserve spatial continuity, confirm input, and reduce perceived latency. It must never compete with source code, agent output, or a pending decision.

### Durations and easing

- **Fast — 120 ms:** hover, pressed, icon, border, color, and badge feedback.
- **Cards — 140 ms:** cards and repeated row feedback.
- **Tabs/Fade — 150 ms:** tab indicators, backdrop, and content fade.
- **Normal — 160 ms:** focus, attachments, and state transitions.
- **Panels/Dialogs — 180 ms:** both sidebars, panel geometry, and dialog surfaces.
- **Slow — 240 ms:** progress and exceptional contextual changes.
- **Standard easing:** `cubic-bezier(.2, .8, .2, 1)` for entrances, exits, and direct manipulation feedback.

Do not create component-specific easings without documenting a physical reason. Components of the same class must use the same duration even when placed in different panels.

### Principles

1. **Continuity over spectacle.** Movement explains where a surface came from and where it went.
2. **Immediate response.** Color, border, or pressed feedback begins within the fast duration.
3. **Small distance.** Content movement is normally 1–10 px; larger travel feels detached from desktop work.
4. **Stable layout.** Animate shell geometry deliberately and avoid incidental content reflow.
5. **Opacity supports position.** Sliding surfaces fade slightly so clipped edges never flicker.
6. **Interruptible interaction.** CSS transitions must reverse naturally when the user changes direction.
7. **Respect preference.** `prefers-reduced-motion` removes nonessential transforms, breathing, and entrances.

### Sidebars

- Both sidebars transition width, flex basis, opacity, border, and content position over 180 ms with the same easing.
- The left sidebar content moves 8–10 px left; the agent inspector content moves 8–10 px right.
- Inspector content uses a synchronized 8–10 px horizontal movement with opacity.
- Closed panels remain mounted for the duration and become `inert`, preventing invisible keyboard targets.
- Panel state must reverse cleanly if the toggle is pressed before the transition finishes. Neither sidebar has a timing or acceleration advantage over the other.

### Panels and tabs

- Activity, Plan, Suggestions, Artifacts, and empty states enter with 3 px vertical movement and fade over 160 ms.
- The active tab underline scales horizontally rather than appearing abruptly.
- Count badges transition surface and border in 120 ms; they do not bounce or pulse.
- Long timeline, artifact, and suggestion lists use `content-visibility: auto` so offscreen cards do not consume unnecessary paint.
- Domain refinements for Agent, Settings, and Suggestions live beside their React domains; cross-product interaction floors remain in `styles/product-constraints.css`. `App.tsx` imports them in canonical cascade order.

### Dialogs

- Backdrops fade over 150 ms.
- Dialog surfaces enter over 180 ms with 3 px vertical movement and a scale change from `.996` to `1`.
- Dialog shadows do not animate independently because large blurred paints are expensive.
- Dismissal should feel immediate; when a future shared presence primitive is introduced, it should mirror the entrance without extending interaction latency.

### Composer and input

- The composer is a single visual surface; the writing area and toolbar have no visible dividing line.
- Hover adjusts only border contrast. Focus adjusts surface, border, and focus shadow over 160 ms.
- The caret uses the accent color and native blink behavior.
- Attachments fade and move vertically by 3 px when added.
- Send icon movement is limited to 1 px; stop feedback uses a subtle scale reduction.
- Placeholder changes rely on color transition, never movement.

### Buttons, cards, and lists

- Buttons respond in 120 ms and move down 1 px while pressed.
- Home cards may lift 1 px on hover; ordinary list rows remain positionally stable.
- Icons may scale to at most `1.025` when their parent row is hovered.
- Disabled controls do not animate and keep a recognizable shape at reduced opacity.
- Focus remains more visible than hover and is never delayed by animation.

### Status and loading

- Starting state uses a restrained 1.8-second opacity/border breath only on the status indicator.
- Running work uses the existing slow rotation on its local activity marker.
- Streaming uses the caret without animating the entire response surface.
- Success, warning, error, waiting, and disconnected transitions change semantic foreground, background, and border together.
- Loading animation must remain local to the component doing work; avoid full-window indeterminate motion.

### Scroll behavior

- Chat, inspector, conversations, settings, previews, and suggestion details contain overscroll.
- Scrollbar gutters remain stable to avoid horizontal layout shift.
- Message scroll uses smooth behavior; nested technical areas remain independently controllable.
- The message end is the scroll anchor, while individual assistant rows do not compete for anchoring.
- Never animate scroll-linked shadows or large blurred backgrounds.

### Paint and reflow guidance

- Animate `opacity`, `transform`, `clip-path`, and deliberate panel dimensions only.
- Do not animate large shadows, backdrop filters, gradients, or code block dimensions.
- Use `content-visibility` for long repeated lists after verifying intrinsic size.
- Avoid permanent `will-change`; it consumes compositor memory during long sessions.
- Memoize expensive rendered content only when profiling identifies repeated work.

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

- The legacy structural layer remains only where it still supplies unique layout behavior. Declarations shadowed by identical selectors were removed without changing computed styles, and `npm run lint:design` now rejects new shadowed declarations before they accumulate.
- A few icon sizes are defined directly in JSX. They align visually, but future work should map icon sizes to explicit component primitives.
- Native `title` tooltips depend on the operating system and do not have the same timing or surface as the application.
- Shared dialog and off-canvas hooks now provide focus containment, Escape handling, initial focus, and focus restoration on the current modal surfaces.
- Project Health explanations currently rely primarily on hover titles in the compact card layout.

### Future suggestions — not implemented

- Create small internal primitives for Button, IconButton, Badge, Tooltip, and Dialog to enforce the documented scale automatically.
- Expand the existing visual regression suite beyond the canonical widths to cover 125% and 150% zoom.
- Add a non-blocking command palette preview only if it becomes part of an approved product phase.
- Preserve the shared focus containment and restoration behavior when adding future modal surfaces.
- Provide a compact, visible explanation affordance for each Project Health metric.
- Validate the palette with automated contrast tooling as part of CI.

The interface now gives the developer's work the strongest visual weight. Navigation and agent context remain available, but their motion, elevation, and saturation stay deliberately restrained.

## UX review — Phase 5.3

The motion review followed the questions “does this feel instant?”, “does this feel smooth?”, and “does this feel natural?” across the existing interface.

### Friction removed

- The right inspector no longer teleports in or out; both directions preserve spatial continuity.
- Tab content no longer appears as a hard visual cut.
- Composer writing area and toolbar now read as one integrated control.
- Status changes transition as one semantic unit instead of independent color changes.
- Hover and pressed timing is consistent across navigation, cards, buttons, and list rows.
- Stable scrollbar gutters reduce horizontal flicker as content begins to overflow.
- Offscreen repeated cards avoid unnecessary paint in long activity and suggestion sessions.
- Completed Markdown messages are memoized, preventing expensive repeat rendering when unrelated shell state changes.

### Profiling observations

- The largest renderer cost remains Markdown parsing/rendering for long responses. Persisted messages now skip unrelated re-renders; the actively streaming message still updates by design and retains existing throttling.
- Activity is capped at 300 entries and detail text at 64,000 characters. `content-visibility` reduces paint for offscreen entries without changing those safety limits.
- Panel width transitions cause deliberate shell layout work for 180 ms. This is bounded, infrequent, and preferable to transform-based panel composition, which would interfere with fixed preview dialogs nested inside the inspector.
- Large shadows and backdrop blur remain static during motion to avoid expensive repaints.

### Remaining polish opportunities — not implemented

- A shared presence primitive could provide true exit animation for every conditionally mounted dialog.
- A controlled textarea height transition could be considered after measuring typing latency on lower-end hardware.
- React Profiler traces from packaged builds could establish budgets for extremely long Markdown conversations.
- Native tooltips could eventually be replaced by a lightweight shared tooltip primitive.

These items were intentionally left for a future approved phase because they require shared behavioral primitives or broader profiling infrastructure.

## UX review — Phase 5.4 final

The final v0.5 review evaluated professional confidence, comfort, affordance, and desktop continuity.

### Resolved

- The product now uses its canonical mark in the application chrome instead of a generic icon.
- Window title and favicon no longer expose the Vite scaffold identity.
- Left and right sidebars share the same 180 ms timing, easing, fade, and mirrored content travel.
- Composer writing and toolbar areas remain one uninterrupted surface.
- Buttons, cards, rows, tabs, chips, and icon controls acknowledge hover, focus, pressed, active, and disabled states.
- Semantic states retain text or icons in addition to color.
- Geist weights, 13 px minimum text, stable scroll gutters, and bounded reading width support long sessions.
- Brand, Electron, GitHub, favicon, monochrome, dark, and raster exports have documented canonical sources.

### Remaining considerations after v0.5 — not implemented in that phase

- Introduce shared Button, Badge, Tooltip, and Dialog primitives only as an approved architectural task.
- Add automated visual and contrast regression checks before the stable release.
- Validate packaged builds with keyboard-only navigation on multiple Linux desktop environments.

No new behavior or product capability was introduced during this final polish review.
