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
  3. Calm by default: no entrance animations, no gradients, no decorative illustrations. The only motion is overlays (popovers, menus, dialogs, sheets, toasts) opening and closing, in 150 ms or less.
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
  - **Notebook, desktop (≥ 1024 px):** top bar with the notebook title. Under it the **Shelf**: one horizontal strip of source chips (status dot, title, then the page count for a PDF or the type, "Text" or "Web page", for the others) with an "Add source" button at its end, scrolling sideways when full. Below the shelf two panes split by a rule: **Ask** (the chat, about 60 %) on the left, and on the right a pane with two tabs, **Reader** (for the hook last pressed: source title, page and the cited excerpt, i.e. `Citation.excerpt` from ARCHITECTURE §7, set in Newsreader with the marker highlight; below it the source's summary) and **Takeaways** (generated notes).
  - **Notebook, tablet (640–1023 px):** the shelf stays; Ask fills the width; Reader and Takeaways open as a sheet from the right.
  - **Notebook, mobile (< 640 px):** the shelf collapses into a "Sources (n)" button that opens a bottom sheet; Ask fills the screen; pressing a hook opens the Reader as a bottom sheet; Takeaways is a second tab in the top bar.
  - **Reader data:** the Reader shows only what a citation already carries (title, page, excerpt of up to 400 characters) plus the source summary from M4. No new API. Pressing a hook also highlights that source's chip on the Shelf. This replaces the citation popover in ARCHITECTURE §7 (R18).
  - **Login:** described in R14; DESIGN.md gets a short section for it, no wireframe.
  - The ASCII wireframes for these five views are part of DESIGN.md, drawn from the descriptions above.
- **R7** **Names in the UI.** Sources area "Shelf", chat "Ask", passage view "Reader", generated notes "Takeaways". Note kinds: briefing → "Brief", FAQ → "Q&A", study guide → "Study sheet", audio (stretch) → "Spoken recap". The chat input placeholder: "Ask about your sources…". None of these are NotebookLM terms (CLAUDE.md rule 1). ARCHITECTURE §8 and §9 link to this list instead of naming features.

### Build
- **R8** **Wordmark and favicon.** The wordmark is "Notehooked" in Newsreader 500 with a small hook glyph before it: an inline SVG of a single stroke (a short vertical line ending in a hook, like a "J" with a round end), drawn by hand for this app, in `hook`. The favicon is `frontend/src/app/icon.svg`: the same glyph in `hook` on a `paper` rounded square, with a dark-mode variant via `prefers-color-scheme` inside the SVG. `/icon.svg` is added to `PUBLIC_PATHS` in `proxy.ts`, so the logged-out login page shows it (NB-003 follow-up).
- **R9** **Tokens.** `frontend/src/app/globals.css` defines the R3 tokens as CSS variables for `:root` and `.dark`, maps shadcn's semantic variables (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, `--destructive`, …) onto them, and exposes them to Tailwind v4 through `@theme` (e.g. `bg-paper`, `text-graphite`, `text-hook`, `bg-marker`). Unused shadcn variables (`chart-*`, `sidebar-*`) are removed. Components use tokens only; no hex or `oklch()` values outside `globals.css` (checked by grep).
- **R10** **Fonts.** `frontend/src/app/layout.tsx` loads both fonts with `next/font/google` as CSS variables; `@theme` sets `--font-sans` to Plex Sans and adds `--font-reading` for Newsreader (`font-reading` utility).
- **R11** **Theme.** `next-themes` (already installed) with `attribute="class"`, `defaultTheme="system"`, `disableTransitionOnChange`; `<html suppressHydrationWarning>`. A theme toggle in the top bar cycles light → dark → system, is a real `<button>`, has an `aria-label` naming the next state ("Switch to dark theme") and a tooltip. The saved theme is only known in the browser, so until the component has mounted it renders a placeholder button of the same size with the label "Change theme" (no hydration mismatch). No flash of the wrong theme on load. The provider wraps the whole app, so `/login` follows the theme saved earlier in the same browser, or the OS setting.
- **R12** **Components.** The installed shadcn components (button, input, textarea, dialog, dropdown-menu, popover, sheet, tooltip, scroll-area, skeleton, sonner) follow R3–R5: token colours, radii, the shadow rule, and a visible focus ring (2 px `hook`, 2 px offset) on every interactive element. Button variants: `default` (ink), `outline` (edge border), `ghost`, `destructive`, `link` (hook). Unused variants are removed.
- **R13** **App shell.** A server `TopBar` in `frontend/src/components/shell/`: wordmark linking to `/` on the left, the theme toggle on the right. Height 56 px, `rule` line below, no shadow. It is mounted by a route group layout, `frontend/src/app/(app)/layout.tsx`, which holds `/` (`(app)/page.tsx`) and `/design` (`(app)/design/page.tsx`); `/login` stays outside the group, so it has no top bar. URLs don't change. M3 adds the notebook title to the top bar for notebook pages; in M2 it has no page context.
- **R14** **Login page.** Restyled per DESIGN.md: centred on `paper`, wordmark on top, one sentence of copy, the password field and the "Open the app" button at full width (max 360 px), error text in `danger`. Behaviour from NB-003 unchanged.
- **R15** **Home page.** The R6 layout with the real empty state, since no notebooks exist until M3: a short Newsreader heading "No notebooks yet", one line of graphite copy ("A notebook holds your sources and the questions you ask about them."), and the "New notebook" button with the tooltip "Available soon". The button uses `aria-disabled="true"`, not the native `disabled` attribute: it stays focusable, its click does nothing, it has the disabled styling, and the tooltip opens on hover and on keyboard focus. The list row is a component, `NotebookRow` in `frontend/src/components/home/notebook-row.tsx`, that M3 reuses.
- **R16** **`/design` page.** A reference page behind the gate (normal page, `noindex`), not linked from the UI: colour swatches with names and values for the current theme (a small client leaf reads each token's CSS variable at runtime with `getComputedStyle(...).getPropertyValue("--paper")`, which returns the value as written in `globals.css`, so the page holds no colour values), the type scale, every button variant, input, textarea, a dropdown, a dialog trigger, a toast trigger, a citation hook and the Reader excerpt it points to with the marker highlight (static mock; pressing the hook highlights the excerpt), and the notebook list with three mock rows. It is how reviewers and later specs check the design. Its mock data lives in the page file only. If the implementation would exceed the ~800-line limit, the `/design` page moves to its own spec (NB-006) and this PR ships without it.
- **R17** **Motion and quality floor.** Transitions only on hover and focus (colour, no movement) and on overlays opening and closing (popover, dropdown, dialog, sheet, tooltip, toast), each ≤ 150 ms. Sonner's default toast transition (longer) is shortened in `globals.css` (`[data-sonner-toast]`). `@media (prefers-reduced-motion: reduce)` turns all of them off. No horizontal scroll at 360 px on `/`, `/login` and `/design`. Every interactive element is reachable by keyboard with a visible focus ring.
- **R18** **Docs.**
  - `docs/DESIGN.md` exists with R2–R7, the token table including `edge`, the five wireframes, a short login section (R14), the component rules (R5, R12) and the quality floor and motion rules (R17).
  - `frontend/README.md`: links DESIGN.md, mentions the `/design` page, the rule that assets the logged-out login page needs go in `PUBLIC_PATHS` by exact path, and updates the Layout tree (`app/(app)/`, `app/design/` under it, `components/shell/`, `components/home/`).
  - `docs/ARCHITECTURE.md` §7 "Rendering": a citation hook opens the Reader (source title, page, excerpt with the marker highlight) and highlights the source's chip on the Shelf, instead of a popover. §8 and §9: feature names point to DESIGN.md → "Names in the UI".
  - `docs/PROGRESS.md`: M2's first task records the name (Notehooked), the Decisions log rows "App name" and "Design" become decided (Notehooked; DESIGN.md).

## Design

**Files**
- `docs/DESIGN.md` (new).
- `frontend/src/lib/config.ts`, `frontend/src/app/{globals.css,layout.tsx,icon.svg}`, `frontend/src/app/(app)/{layout,page}.tsx` (`page.tsx` moves into the group), `frontend/src/app/(app)/design/{page,token-swatches}.tsx` (new), `frontend/src/app/login/{page,login-form}.tsx`, `frontend/src/components/shell/{top-bar,theme-toggle,wordmark}.tsx` (new), `frontend/src/components/home/notebook-row.tsx` (new), `frontend/src/components/ui/*.tsx` (restyled), `frontend/src/proxy.ts` (`/icon.svg` in `PUBLIC_PATHS`).
- `README.md`, `frontend/README.md`, `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`.

**Rejected alternatives**
- **Three side-by-side columns (sources | chat | notes):** the most obvious arrangement and the one NotebookLM uses. The shelf on top and a reader pane next to the chat keep the same functions in our own layout, and give the citation (the product's point) a place to land.
- **One typeface:** a serif for reading content is what makes answers and passages feel like a document rather than a chat app.
- **Coloured primary buttons:** the accent would mean "click here" and "this is cited" at once. Ink buttons keep plum for citations.
- **A theme that only follows the system:** reviewers should be able to check dark mode without changing their OS setting.
- **Showing mock notebooks on the home page:** in the live demo they would look like real data. The home page shows the honest empty state; the list design is visible on `/design`.

**Dependencies.** None new: `next/font`, `next-themes`, `lucide-react` and the shadcn components are installed.

**Size.** Roughly 600–750 changed lines of code (tokens, components, shell, three pages, icon), plus DESIGN.md. Within the ~800-line limit (`WORKFLOW.md` §1), but close: if it would go over, `/design` becomes NB-006 (R16).

## Implementation

- [ ] **Implemented** (`feat/NB-005-name-design`)
  - No user steps.
  - Acceptance:
    - CI passes (lint, typecheck, test, build).
    - `git grep -n "Untitled notebook app"` finds nothing; the browser tab title is "Notehooked"; the page source of `/` has the R1 `meta name="description"`; `git grep -in "notebooklm\|gemini\|google" -- frontend/src` finds no name, title or metadata use (font imports from `next/font/google` are allowed).
    - `docs/DESIGN.md` contains principles, the token table with light and dark values (including `edge`), the type scale, shape rules, the five wireframes, the UI names and the quality floor.
    - `git grep -nE "#[0-9a-fA-F]{3,8}\b|oklch\(" -- frontend/src ':!frontend/src/app/globals.css' ':!frontend/src/app/icon.svg'` finds no colour values in components.
    - `edge` reaches 3:1 against `surface` in both themes (ratio recorded in DESIGN.md).
    - `git grep -nE "sidebar-|chart-" -- frontend/src` finds nothing (R9).
    - On the preview, logged in:
      - `/` shows the top bar, the empty state and the "New notebook" button with disabled styling, in light and dark, and at 360 px width without horizontal scroll. The button's tooltip opens on hover and on keyboard focus, and clicking it does nothing.
      - DevTools → Computed shows IBM Plex Sans on a button and Newsreader on the wordmark and the empty-state heading (R10).
      - The theme toggle cycles light → dark → system; reloading keeps the choice; no flash of the wrong theme.
      - `/design` shows every item in R16 in both themes; the swatch values match DESIGN.md; pressing the citation hook highlights the Reader excerpt with the marker; the page source has `<meta name="robots" content="noindex">`.
      - Tabbing through `/` and `/design` shows the focus ring on every interactive element.
      - Opening the dropdown, the dialog and a toast takes 150 ms or less; with "reduce motion" enabled in the OS, none of them animates.
      - The theme toggle's first server-rendered label is "Change theme" and the console shows no hydration warning.
    - On the preview, logged out (private window): `/login` matches R14 (wordmark, one sentence, full-width field and button up to 360 px, error in `danger`) at 360 px and in both themes (dark via the OS setting, since `/login` has no toggle); it has no top bar; the favicon shows in the tab, and `/icon.svg` returns the SVG (not a redirect).
    - `frontend/README.md` (including the Layout tree), ARCHITECTURE §7/§8/§9 and PROGRESS are updated as in R18.
    - **After merge, on production:** the home page matches DESIGN.md in light and dark mode and on mobile (M2's "Done when").

## Open questions
None. Decided by the user (2026-11-14): plum `#7A2E63` as the accent, the theme toggle in the top bar, the `/design` reference page stays, and the UI names in R7 as written.

## Notes
