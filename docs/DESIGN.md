# Design

How Notehooked looks and behaves. Approved in NB-005 (`specs/NB-005-name-and-design.md`). The tokens live in `frontend/src/app/globals.css`; `/design` in the running app shows all of this in the current theme.

## Principles

1. **Every answer is hooked to a passage.** The one bold element of the design is the citation: a plum hook that, when pressed, lights up the passage it came from with a highlighter mark. Everything else stays quiet so this stands out.
2. **It reads like a desk, not a dashboard:** paper-like surfaces, thin rules instead of boxes and shadows, and a serif for anything you read (answers, passages, notes).
3. **Calm by default:** no entrance animations, no gradients, no decorative illustrations. Nothing moves except overlays (tooltips, popovers, menus, dialogs, sheets, toasts) opening and closing; hover and focus only change colour. All of it takes 150 ms or less.
4. **Plain words:** sentence case, buttons say what happens, no ALL-CAPS labels.

## Colour

Five named colours and four supporting tokens, each with a light and a dark value. Components use the token utilities (`bg-paper`, `text-graphite`, `text-hook`, `bg-marker`, `border-rule`, `border-edge`, …), never colour values.

| Token | Role | Light | Dark |
|---|---|---|---|
| `paper` | page background | `#F5F6F7` | `#121417` |
| `surface` | panels, inputs, popovers | `#FFFFFF` | `#1A1D21` |
| `ink` | text, primary buttons | `#1A1D21` | `#E4E6E1` |
| `graphite` | secondary text, icons | `#59616B` | `#9DA5AE` |
| `rule` | dividers and panel borders | `#D5DAE0` | `#2E333A` |
| `edge` | input and outline-button borders | `#828A94` | `#6B737D` |
| `hook` | the accent: citation hooks, links, focus ring | `#7A2E63` (plum) | `#E39BD2` |
| `marker` | highlight behind a cited passage | `#F4E48C` | `#5C4F1A` |
| `danger` | errors and destructive actions | `#B42318` | `#F97066` |

Plus `scrim` (the dimmed backdrop behind dialogs and sheets) and the overlay shadow, both in `globals.css`.

**Contrast (WCAG 2.x):**
- Light: ink on paper 15.6, graphite on paper 5.8, hook on paper 8.1, danger on paper 6.1, ink on marker 13.2.
- Dark: ink on paper 14.7, graphite 7.4, hook 8.7, danger 6.6, ink on marker 6.5.
- `edge` (non-text, needs 3:1): light 3.49 on surface and 3.23 on paper; dark 3.52 on surface and 3.84 on paper.

**Rules**
- `hook` appears only on citations, links, the focus ring, the wordmark and the favicon. Primary buttons are `ink` on `paper`, so the accent keeps its meaning.
- Not used anywhere: Google's logo colours, Material You tonal palettes, cream with terracotta, black with a neon accent, gradients.

## Type

| Role | Face | Size / line height |
|---|---|---|
| Page heading | IBM Plex Sans 600 | 1.75 rem / 1.2 |
| Section heading | IBM Plex Sans 500 | 1.375 rem / 1.3 |
| Reading: answers, passages, notes | Newsreader 400 (`font-reading`) | 1.0625 rem / 1.6 |
| Body UI | IBM Plex Sans 400 | 1 rem / 1.5 |
| Small UI | IBM Plex Sans 400–500 | 0.875 rem / 1.45 |
| Caption | IBM Plex Sans 400 | 0.75 rem / 1.4 |

- Both faces are loaded with `next/font/google`, which self-hosts them at build time (no runtime request to a font CDN).
- The wordmark and reading headings (e.g. the empty state) use Newsreader 500.
- Citation numbers use Plex Sans with tabular numerals.
- Headings are 500 or 600 weight and never uppercase.

## Shape and depth

- Radius 4 px for inputs, buttons and chips, 8 px for dialogs and sheets. No pill buttons, except the citation hooks.
- Panels are separated by 1 px `rule` lines, not cards. Lists are rows with dividers, not grids of identical cards.
- Shadows only on overlays (popover, dropdown, dialog, sheet, toast), all with the one soft overlay shadow.

## Components

The shadcn components in `frontend/src/components/ui/` follow the rules above.

- **Button variants:** `default` (ink, the primary action), `outline` (edge border on surface), `ghost`, `destructive` (danger), `link` (hook). Sizes `sm`, `default`, `lg`, `icon`, `icon-sm`.
- **Disabled but explained:** a button that's unavailable for now uses `aria-disabled="true"`, not `disabled`. It stays focusable, so its tooltip works by keyboard too.
- **Focus:** every interactive element shows a 2 px `hook` outline with a 2 px offset on keyboard focus (one rule in `globals.css`, not per component).
- **Inputs** sit on `surface` with an `edge` border; an invalid field gets a `danger` border.
- **Tooltips** are `ink` on `paper`. Toasts, popovers and menus are `surface` with a `rule` border and the overlay shadow.
- **Skeletons** are static `rule`-tinted blocks, without a pulse.

## Motion

- Hover and focus change colour only, in 150 ms.
- Overlays (tooltip, popover, dropdown, dialog, sheet, toast) open and close in 150 ms or less. Sonner's own toast transition is shortened to 150 ms in `globals.css`.
- `prefers-reduced-motion: reduce` turns all transitions and animations off.
- A loading spinner is the only continuous animation, and reduced motion stops it too.

## Theme

- Light, dark or the system setting, via `next-themes` (`class` on `<html>`). The default is the system setting.
- The toggle in the top bar cycles light → dark → system. Its label names the next state ("Switch to dark theme"). Before hydration it renders a same-size placeholder labelled "Change theme", so the server and client markup match.
- `/login` has no toggle; it follows the theme saved earlier in the same browser, or the OS setting.

## Wordmark and favicon

- **The mark:** a fishhook (eye, shank, bend and barbed point) in `hook`, with a note in `marker` yellow hooked on its bend: the bend passes behind the paper's top edge, as if threaded through it. The note has two `ink` lines of text. It says the product in one picture: the passage is caught on the hook.
- **Wordmark:** "Notehooked" in Newsreader 500, after the mark (`HookMark`, 28 px). The hook takes `currentColor` (`text-hook`), the note uses the `marker` and `ink` tokens, so it follows the theme.
- **Favicon:** `frontend/src/app/icon.svg`, the same mark on a rounded `paper` square, with a dark variant inside the SVG. It stays legible at 16 and 32 px. `/icon.svg` is a public path in the proxy, so the logged-out login page shows it.

## Names in the UI

| Area | Name |
|---|---|
| Sources of a notebook | Shelf |
| Chat | Ask (input placeholder: "Ask about your sources…") |
| Passage view for a citation | Reader |
| Generated notes (not planned, M6 cut) | Takeaways |
| Briefing / FAQ / study guide / audio (not planned, M6/M7 cut) | Brief / Q&A / Study sheet / Spoken recap |

None of these are NotebookLM's terms (CLAUDE.md rule 1).

## Layout

Breakpoints: mobile below 640 px, tablet 640–1023 px, desktop from 1024 px. Layout switches only through CSS breakpoints.

### App shell
A 56 px top bar with a `rule` line below and no shadow: the wordmark (link home) on the left, the theme toggle on the right. Notebook pages add the notebook title (truncated, the full title in a tooltip) and a "Notebook options" menu (Rename, Delete notebook) before the theme toggle. `/login` has no top bar.

### Home, desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ ⌐ Notehooked                                                  ◐   │
├────────────────────────────────────────────────────────────────────┤
│            Your notebooks                       [ New notebook ]   │
│            ─────────────────────────────────────────────────────   │
│            Climate report reading group                            │
│            3 sources · edited 12 Nov                               │
│            ─────────────────────────────────────────────────────   │
│            Thesis: early modern trade routes                       │
│            7 sources · edited 9 Nov                                │
│            ─────────────────────────────────────────────────────   │
│                                    max width 760 px, centred       │
└────────────────────────────────────────────────────────────────────┘

Empty state (no notebooks), in place of the list:
│            Your notebooks                       [ New notebook ]   │
│            ─────────────────────────────────────────────────────   │
│            No notebooks yet                                        │
│            A notebook holds your sources and the questions you     │
│            ask about them.                                         │
```

### Home, mobile (360 px and up)

```
┌──────────────────────────────┐
│ ⌐ Notehooked              ◐ │
├──────────────────────────────┤
│ Your notebooks               │
│ [        New notebook      ] │
│ ──────────────────────────── │
│ Climate report reading group │
│ 3 sources · edited 12 Nov    │
│ ──────────────────────────── │
│ (or: No notebooks yet + copy)│
└──────────────────────────────┘
  16 px gutters
```

### Notebook, desktop (1024 px and up)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ⌐ Notehooked   Climate report reading group                          ◐  │
├──────────────────────────────────────────────────────────────────────────┤
│ Shelf  [● Climate summary · 18 p.] [● Article · Web page] [○ Notes · Text] [+ Add source] → │
├──────────────────────────────────────────┬───────────────────────────────┤
│ Ask                                      │  Reader | Takeaways           │
│                                          │                               │
│  What drives most of the warming?        │  Climate summary · page 4     │
│                                          │  …it is extremely likely that │
│  Most of the warming since 1950 comes    │  ▓more than half of the       │
│  from greenhouse gases (1) …             │  ▓observed increase…▓, toge-  │
│                                          │  ther with other influences…  │
│                                          │  ───────────────────────────  │
│                                          │  Summary of the source        │
│ ┌──────────────────────────────────────┐ │                               │
│ │ Ask about your sources…            ↵ │ │                               │
│ └──────────────────────────────────────┘ │                               │
└──────────────────────────────────────────┴───────────────────────────────┘
        Ask ≈ 60 %                               Reader / Takeaways ≈ 40 %
```

- The Shelf is one horizontal strip of source chips: a status dot, the title, then the page count for a PDF or the type ("Text", "Web page") for the others. It scrolls sideways when full; "Add source" sits at its end.
- **Reader:** for the hook last pressed, it shows the source title, the page (or the type) and the cited excerpt (`Citation.excerpt`, up to 400 characters, ARCHITECTURE §7) in Newsreader with the `marker` highlight, and below it the source's summary (from the notebook's sources list). Pressing a hook also highlights that source's chip on the Shelf; pressing it again, or "Close", clears both. Without an active hook the pane says how to open a passage.
- **Ask controls (NB-010):** the empty chat shows up to 5 suggested questions as outline buttons; a "Clear chat" ghost button in the Ask header (hidden while an answer streams) opens a confirmation dialog.
- **Source selection (NB-010):** each ready source's popover has a "Use in answers" toggle. An excluded chip shows `graphite` text and a hollow dot, and a line above the input says "Answering from n of m sources"; with none left, the input is disabled with "Pick at least one source to ask about."
- **Takeaways** would list the generated notes (Brief, Q&A, Study sheet, Spoken recap). **Not planned:** M6 and M7 are cut, so the right pane, the tablet sheet and the mobile top bar show only the **Reader**, without tabs. The wireframes keep the tab to show where it would go.

### Notebook, tablet (640–1023 px)

```
┌──────────────────────────────────────────────────┐
│ ⌐ Notehooked   Climate report reading group   ◐ │
├──────────────────────────────────────────────────┤
│ Shelf [● Climate summary] [● Article] [+ Add] →  │
├──────────────────────────────────────────────────┤
│ Ask                          [Reader] [Takeaways]│
│  …answer with hooks (1) (2)…                     │
│                                  ┌──────────────┐│
│                                  │ Reader sheet ││
│                                  │ from the     ││
│ [ Ask about your sources…    ↵ ] │ right        ││
└──────────────────────────────────┴──────────────┘┘
```

The Shelf stays; Ask fills the width; the Reader opens as a sheet from the right **only from a hook** (NB-010): there's no "Reader" button in the Ask header (the wireframe's buttons are from before NB-010), because closing the sheet clears the active citation and a button could only open an empty sheet.

### Notebook, mobile (below 640 px)

```
┌──────────────────────────────┐
│ ⌐ Climate report…   Ask|Take◐│
├──────────────────────────────┤
│ [ Sources (3) ]              │
├──────────────────────────────┤
│  …answer with hooks (1)…     │
│                              │
│ [ Ask about your sources… ↵ ]│
└──────────────────────────────┘
 Pressing a hook:
┌──────────────────────────────┐
│ ───── Reader (bottom sheet) ─│
│ Climate summary · page 4     │
│ ▓…cited excerpt…▓            │
└──────────────────────────────┘
```

The Shelf collapses into a "Sources (n)" button that opens a bottom sheet; Ask fills the screen; a hook opens the Reader as a bottom sheet. (Takeaways would be a second tab in the top bar; not planned, M6 cut.)

### Login

No top bar. Centred on `paper`, up to 360 px wide: the wordmark, one sentence ("This demo is private. Enter the password you were sent."), the password field and the "Open the app" button at full width, and the error in `danger` below the field.

## Quality floor

- Responsive down to 360 px with no horizontal scroll; layout changes only through CSS breakpoints.
- Every interactive element is reachable by keyboard and shows the focus ring.
- `prefers-reduced-motion` is respected (see "Motion").
- Text contrast passes WCAG AA, and non-text elements (borders, focus ring) reach 3:1.
- Copy in English, sentence case, buttons say what happens.
