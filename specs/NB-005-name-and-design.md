# NB-005 · Name and design: Notehooked

**Type:** feat   **Milestone:** M2   **Depends on:** NB-003

## Goal
The app has its own name, Notehooked, and its own look: a documented design (`docs/DESIGN.md`) built into tokens, fonts, components, an app shell, a favicon, the login page and the home page, in light and dark mode and on mobile. Every later milestone builds its UI from this, not from shadcn defaults.

## Scope
- **In:**
  - The name: `APP_NAME`, page title, README.
  - `docs/DESIGN.md`, written from the design plan in this spec (R2–R7). Merging this spec approves the plan.
  - Colour and type tokens (light and dark), fonts via `next/font`, the shadcn components restyled, a theme toggle.
  - App shell (top bar), favicon, the login page restyled, the home page with its empty state.
  - A `/design` reference page that shows tokens, type and components, including the notebook list with mock rows.
  - The UI names of the product areas (ARCHITECTURE §8 leaves them to the design).
- **Out:**
  - Real notebooks: create, rename, delete and the list from the database are M3. The "New notebook" button is shown but disabled until M3.
  - The notebook screen itself. M2 only fixes its layout as wireframes in `docs/DESIGN.md`; M3 builds the shell, later milestones fill it.
  - Logo artwork beyond the wordmark and the hook glyph (R8).
  - Cookie banner (follow-up in memory, separate decision).

## Requirements

### Name
- **R1** `APP_NAME` in `frontend/src/lib/config.ts` is `"Notehooked"`. The root `README.md` title becomes `# Notehooked`, and the placeholder comment under it is removed. The page title comes from `APP_NAME` (already wired in `layout.tsx`), and `metadata.description` gets one plain sentence ("Ask questions about your own documents and get answers that point to the exact passage."). No "NotebookLM", "Google" or "Gemini" in name, title or metadata (CLAUDE.md rule 1).

### Design plan (written to `docs/DESIGN.md`)
- **R2** **Principles** (in DESIGN.md, verbatim or close):
  1. Every answer is hooked to a passage. The one bold element of the design is the citation: a plum hook that, when pressed, lights up the passage it came from with a highlighter mark. Everything else stays quiet so this stands out.
  2. It reads like a desk, not a dashboard: paper-like surfaces, thin rules instead of boxes and shadows, and a serif for anything you read (answers, passages, notes).
  3. Calm by default: no entrance animations, no gradients, no decorative illustrations. Motion only confirms an action and stays under 150 ms.
  4. Plain words: sentence case, buttons say what happens, no ALL-CAPS labels.
- **R3** **Colour.** Five named colours (`paper`, `ink`, `graphite`, `hook`, `marker`, as M2 asks for 4–6) and the supporting tokens `surface`, `rule`, `edge` and `danger`, each with a light and a dark value. Contrast ratios were computed for this spec (WCAG 2.x):

  | Token | Role | Light | Dark |
  |---|---|---|---|
  | `paper` | page background | `#F5F6F7` | `#121417` |
  | `surface` | panels, inputs, popovers | `#FFFFFF` | `#1A1D21` |
  | `ink` | text, primary buttons | `#1A1D21` | `#E4E6E1` |
  | `graphite` | secondary text, icons | `#59616B` | `#9DA5AE` |
  | `rule` | dividers and panel borders | `#D5DAE0` | `#2E333A` |
  | `hook` | the accent: citation hooks, links, focus ring | `#7A2E63` (plum) | `#E39BD2` |
  | `marker` | highlight behind a cited passage | `#F4E48C` | `#5C4F1A` |

  `danger` (`#B42318` / `#F97066`) marks errors and destructive actions. `edge` is for input and button outlines, which must reach 3:1 against `surface` (WCAG 1.4.11; the implementation picks the value and records it in DESIGN.md).
  - Measured contrast, light: ink on paper 15.6, graphite on paper 5.8, hook on paper 8.1, danger on paper 6.1, ink on marker 13.2. Dark: ink 14.7, graphite 7.4, hook 8.7, danger 6.6, ink on marker 6.5. All text pairs pass AA; the focus ring (hook) passes the 3:1 for non-text.
  - Not used anywhere: Google's logo colours, Material You tonal palettes, cream with terracotta, black with a neon accent, gradients.
  - `hook` appears only on citations, links, the focus ring and the favicon. Primary buttons are `ink` on `paper`, so the accent keeps its meaning.
- **R4** **Type.** Two typefaces, both loaded with `next/font/google` (self-hosted at build time, no runtime request to Google):
  - **IBM Plex Sans** (400, 500, 600) for the UI: navigation, buttons, labels, inputs, the source list.
  - **Newsreader** (400, 500, 400 italic) for reading: chat answers, passages in the reader, notes, and the wordmark.
  - Citation numbers use Plex Sans with tabular numerals.
  - Scale (rem, line height): 0.75/1.4 caption · 0.875/1.45 small UI · 1/1.5 body UI · 1.0625/1.6 reading (Newsreader) · 1.375/1.3 section heading · 1.75/1.2 page heading. Headings are 500 or 600 weight, never uppercase.
- **R5** **Shape and depth.** Radius 4 px for inputs, buttons and chips, 8 px for dialogs and sheets; no pill buttons except the citation hooks. Panels are separated by 1 px `rule` lines, not cards. Shadows only on overlays (popover, dropdown, dialog, sheet, toast), one soft shadow token. Lists are rows with dividers, not grids of identical cards.
- **R6** **Layout (wireframes in DESIGN.md).** The functions match the product (sources, chat, generated notes), the arrangement is our own:
  - **Home, desktop:** top bar; a page heading "Your notebooks" with the "New notebook" button on the right; below it a single-column list of rows (title in Newsreader, then "n sources · edited <date>" in graphite), separated by rules, max width 760 px, centred.
  - **Home, mobile (≥ 360 px):** the same list full width with 16 px gutters; the button moves under the heading at full width.
  - **Notebook, desktop (≥ 1024 px):** top bar with the notebook title. Under it the **Shelf**: one horizontal strip of source chips (status dot, title, page count) with an "Add source" button at its end, scrolling sideways when full. Below the shelf two panes split by a rule: **Ask** (the chat, about 60 %) on the left, and on the right a pane with two tabs, **Reader** (the passage a hook points to, with the marker highlight, and the source's summary) and **Takeaways** (generated notes).
  - **Notebook, tablet (640–1023 px):** the shelf stays; Ask fills the width; Reader and Takeaways open as a sheet from the right.
  - **Notebook, mobile (< 640 px):** the shelf collapses into a "Sources (n)" button that opens a bottom sheet; Ask fills the screen; pressing a hook opens the Reader as a bottom sheet; Takeaways is a second tab in the top bar.
  - The ASCII wireframes for these five views are part of DESIGN.md, drawn from the descriptions above.
- **R7** **Names in the UI.** Sources area "Shelf", chat "Ask", passage view "Reader", generated notes "Takeaways". Note kinds: briefing → "Brief", FAQ → "Q&A", study guide → "Study sheet", audio (stretch) → "Spoken recap". The chat input placeholder: "Ask about your sources…". None of these are NotebookLM terms (CLAUDE.md rule 1). ARCHITECTURE §8 and §9 link to this list instead of naming features.

### Build
- **R8** **Wordmark and favicon.** The wordmark is "Notehooked" in Newsreader 500 with a small hook glyph before it: an inline SVG of a single stroke (a short vertical line ending in a hook, like a "J" with a round end), drawn by hand for this app, in `hook`. The favicon is `frontend/src/app/icon.svg`: the same glyph in `hook` on a `paper` rounded square, with a dark-mode variant via `prefers-color-scheme` inside the SVG. `/icon.svg` is added to `PUBLIC_PATHS` in `proxy.ts`, so the logged-out login page shows it (NB-003 follow-up).
- **R9** **Tokens.** `frontend/src/app/globals.css` defines the R3 tokens as CSS variables for `:root` and `.dark`, maps shadcn's semantic variables (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, `--destructive`, …) onto them, and exposes them to Tailwind v4 through `@theme` (e.g. `bg-paper`, `text-graphite`, `text-hook`, `bg-marker`). Unused shadcn variables (`chart-*`, `sidebar-*`) are removed. Components use tokens only; no hex or `oklch()` values outside `globals.css` (checked by grep).
- **R10** **Fonts.** `frontend/src/app/layout.tsx` loads both fonts with `next/font/google` as CSS variables; `@theme` sets `--font-sans` to Plex Sans and adds `--font-reading` for Newsreader (`font-reading` utility).
- **R11** **Theme.** `next-themes` (already installed) with `attribute="class"`, `defaultTheme="system"`, `disableTransitionOnChange`; `<html suppressHydrationWarning>`. A theme toggle in the top bar cycles light → dark → system, is a real `<button>`, has an `aria-label` naming the next state ("Switch to dark theme") and a tooltip. No flash of the wrong theme on load.
- **R12** **Components.** The installed shadcn components (button, input, textarea, dialog, dropdown-menu, popover, sheet, tooltip, scroll-area, skeleton, sonner) follow R3–R5: token colours, radii, the shadow rule, and a visible focus ring (2 px `hook`, 2 px offset) on every interactive element. Button variants: `default` (ink), `outline` (edge border), `ghost`, `destructive`, `link` (hook). Unused variants are removed.
- **R13** **App shell.** A server `TopBar` in `frontend/src/components/shell/`: wordmark linking to `/`, then a slot for page context (empty on home), then the theme toggle on the right. Height 56 px, `rule` line below, no shadow. It renders on every page except `/login`.
- **R14** **Login page.** Restyled per DESIGN.md: centred on `paper`, wordmark on top, one sentence of copy, the password field and the "Open the app" button at full width (max 360 px), error text in `danger`. Behaviour from NB-003 unchanged.
- **R15** **Home page.** The R6 layout with the real empty state, since no notebooks exist until M3: a short Newsreader heading "Nothing on the shelf yet", one line of graphite copy ("A notebook holds your sources and the questions you ask about them."), and the "New notebook" button, disabled with the tooltip "Available soon". The list row is a component (`NotebookRow`) that M3 reuses.
- **R16** **`/design` page.** A reference page behind the gate (normal page, `noindex`), not linked from the UI: colour swatches with names and values for the current theme, the type scale, every button variant, input, textarea, a dropdown, a dialog trigger, a toast trigger, a citation hook with its popover and marker highlight (static mock), and the notebook list with three mock rows. It is how reviewers and later specs check the design. Its mock data lives in the page file only.
- **R17** **Motion and quality floor.** Transitions only on hover, focus and open/close, ≤ 150 ms; `@media (prefers-reduced-motion: reduce)` turns them off. No horizontal scroll at 360 px on `/`, `/login` and `/design`. Every interactive element is reachable by keyboard with a visible focus ring.
- **R18** **Docs.**
  - `docs/DESIGN.md` exists with R2–R7, the token table including `edge`, the five wireframes, the component rules (R5, R12) and the quality floor (R17).
  - `frontend/README.md`: links DESIGN.md, mentions the `/design` page, and the rule that assets the logged-out login page needs go in `PUBLIC_PATHS` by exact path.
  - `docs/ARCHITECTURE.md` §8 and §9: feature names point to DESIGN.md → "Names in the UI".
  - `docs/PROGRESS.md`: M2's first task records the name (Notehooked), the Decisions log rows "App name" and "Design" become decided (Notehooked; DESIGN.md).

## Design

**Files**
- `docs/DESIGN.md` (new).
- `frontend/src/lib/config.ts`, `frontend/src/app/{globals.css,layout.tsx,page.tsx,icon.svg}`, `frontend/src/app/login/{page,login-form}.tsx`, `frontend/src/app/design/page.tsx` (new), `frontend/src/components/shell/{top-bar,theme-toggle,wordmark}.tsx` (new), `frontend/src/components/notebooks/notebook-row.tsx` (new), `frontend/src/components/ui/*.tsx` (restyled), `frontend/src/proxy.ts` (`/icon.svg` in `PUBLIC_PATHS`).
- `README.md`, `frontend/README.md`, `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`.

**Rejected alternatives**
- **Three side-by-side columns (sources | chat | notes):** the most obvious arrangement and the one NotebookLM uses. The shelf on top and a reader pane next to the chat keep the same functions in our own layout, and give the citation (the product's point) a place to land.
- **One typeface:** a serif for reading content is what makes answers and passages feel like a document rather than a chat app.
- **Coloured primary buttons:** the accent would mean "click here" and "this is cited" at once. Ink buttons keep plum for citations.
- **A theme that only follows the system:** reviewers should be able to check dark mode without changing their OS setting.
- **Showing mock notebooks on the home page:** in the live demo they would look like real data. The home page shows the honest empty state; the list design is visible on `/design`.

**Dependencies.** None new: `next/font`, `next-themes`, `lucide-react` and the shadcn components are installed.

**Size.** Roughly 600–750 changed lines of code (tokens, components, shell, three pages, icon), plus DESIGN.md. Within the ~800-line limit (`WORKFLOW.md` §1).

## Implementation

- [ ] **Implemented** (`feat/NB-005-name-design`)
  - No user steps.
  - Acceptance:
    - CI passes (lint, typecheck, test, build).
    - `git grep -n "Untitled notebook app"` finds nothing; the browser tab title is "Notehooked"; `git grep -in "notebooklm\|gemini\|google" -- frontend/src` finds no name, title or metadata use (font imports from `next/font/google` are allowed).
    - `docs/DESIGN.md` contains principles, the token table with light and dark values (including `edge`), the type scale, shape rules, the five wireframes, the UI names and the quality floor.
    - `git grep -nE "#[0-9a-fA-F]{3,8}\b|oklch\(" -- frontend/src ':!frontend/src/app/globals.css' ':!frontend/src/app/icon.svg'` finds no colour values in components.
    - `edge` reaches 3:1 against `surface` in both themes (ratio recorded in DESIGN.md).
    - On the preview, logged in:
      - `/` shows the top bar, the empty state and the disabled "New notebook" button with its tooltip, in light and dark, and at 360 px width without horizontal scroll.
      - The theme toggle cycles light → dark → system; reloading keeps the choice; no flash of the wrong theme.
      - `/design` shows every item in R16 in both themes; the citation hook opens its popover and the marker highlight is visible.
      - Tabbing through `/` and `/design` shows the focus ring on every interactive element.
      - With "reduce motion" enabled in the OS, opening the dropdown and the dialog has no animation.
    - On the preview, logged out (private window): `/login` matches DESIGN.md in both themes and at 360 px, the favicon shows in the tab, and `/icon.svg` returns the SVG (not a redirect).
    - `frontend/README.md`, ARCHITECTURE §8/§9 and PROGRESS are updated as in R18.
    - **After merge, on production:** the home page matches DESIGN.md in light and dark mode and on mobile (M2's "Done when").

## Open questions
1. **Accent colour:** plum `#7A2E63` (recommended, as specified), petrol `#1F5F74`, or forest `#2F5D3A`? The contrast numbers above are for plum; another choice gets recomputed.
2. **Theme toggle** in the top bar (recommended), or follow the system setting only?
3. **`/design` reference page:** keep it in the app (recommended), or leave it out and check the design on the home and login pages only?
4. **UI names** (R7: Shelf, Ask, Reader, Takeaways; Brief, Q&A, Study sheet, Spoken recap): fine as they are, or change any?

## Notes
