---
name: Ahead LMS
description: The learner area drawn as a metro line, ridden station by station to the certificate.
colors:
  metro-navy: "#17183b"
  metro-navy-hover: "#26285a"
  metro-blue: "#1d46e5"
  metro-coral: "#ff555b"
  metro-tint: "#edf3fb"
  metro-pill: "#e6edfb"
  metro-slate: "#424b70"
  metro-muted: "#4b5276"
  metro-meta: "#4a568f"
  metro-hair: "#e3e7ef"
  metro-dormant: "#d6def4"
  metro-dormant-bg: "#eef2fb"
  ground: "#ffffff"
  status-success-bg: "#e7f6ec"
  status-success: "#2f9e5b"
  status-success-ink: "#17643a"
  status-warning-bg: "#fff3e0"
  status-warning-ink: "#9a4a06"
typography:
  display:
    fontFamily: "Winky Sans, sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
  plaque:
    fontFamily: "Winky Sans, sans-serif"
    fontSize: "50px"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "0"
  headline:
    fontFamily: "Winky Sans, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Winky Sans, sans-serif"
    fontSize: "25px"
    fontWeight: 800
    lineHeight: 1.1
  signage:
    fontFamily: "Winky Sans, sans-serif"
    fontSize: "16.5px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Martel Sans, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.55
  body-small:
    fontFamily: "Martel Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Martel Sans, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  tag: "6px"
  control-sm: "10px"
  control: "12px"
  plaque: "14px"
  pill: "17px"
  marker: "50%"
spacing:
  xs: "8px"
  sm: "14px"
  md: "26px"
  lg: "44px"
components:
  button-primary:
    backgroundColor: "{colors.metro-navy}"
    textColor: "{colors.ground}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "0 26px"
    height: "56px"
  button-primary-hover:
    backgroundColor: "{colors.metro-navy-hover}"
  button-line:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.metro-blue}"
    rounded: "{rounded.control-sm}"
    padding: "0 16px"
    height: "44px"
  button-line-hover:
    backgroundColor: "{colors.metro-tint}"
  line-pill:
    backgroundColor: "{colors.metro-pill}"
    textColor: "{colors.metro-blue}"
    typography: "{typography.signage}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "34px"
  here-tag:
    backgroundColor: "{colors.metro-coral}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "3px 10px 2px"
  title-plaque:
    backgroundColor: "{colors.metro-navy}"
    textColor: "{colors.ground}"
    typography: "{typography.plaque}"
    rounded: "{rounded.plaque}"
    padding: "14px 40px"
  callout:
    backgroundColor: "{colors.metro-tint}"
    textColor: "{colors.metro-navy}"
    rounded: "{rounded.plaque}"
    padding: "22px 36px 26px"
  journey-strip:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.metro-navy}"
    rounded: "{rounded.control}"
    padding: "26px 22px 24px"
---

# Design System: Ahead LMS

## Overview

**Creative North Star: "La ligne de métro"**

A training is a metro line the learner rides to its terminus, the certificate. Every lesson is a station, every module an interchange, and the next station is always one press away. The interface borrows the grammar of transit signage: a white ground, deep navy enamel plaques carrying titles, one thick electric blue line with round station markers, and a single coral mark for "Vous êtes ici". It replaces the category's checklist syllabus with a thin progress bar.

Density is calm and generous. Text is set large (20px body) in a wide reading column, the signage face speaks only on plaques, line labels and headings, and decoration is limited to the line itself and its markers. Panels are plaques (light blue tint or navy enamel), never shadowed cards. Motion is a single gesture: the coral position ring lands once on its station when the page opens.

**Scope.** Since 2026-10-01 the whole app uses this world. The learner formation and lesson pages use the full signage register; the learner overview pages (dashboard, progression) and the admin areas (`/org`, `/tuteur`, `/admin`) use the calm register described at the end of this file. The admin screens keep their historical token names (`--navy`, `--coral`, `--bg`, `--card`, `--font-jakarta`, `--font-barlow`) remapped in `app/globals.css` to this world: `--coral` now means the accent blue, and the two font variables point to Martel Sans and Winky Sans. **Responsive** is a planned second phase and has not been designed: the world is specified for desktop; the few existing media queries are stopgaps, not a responsive system.

**Key Characteristics:**
- White ground, navy ink, one electric blue line, coral only for the learner's position.
- Winky Sans for signage (titles, plaques, line and station names); Martel Sans for reading.
- Titles sit on navy enamel plaques; secondary panels are flat light-blue plaques.
- Progress is drawn as a line with station markers whose state is shape plus color, never color alone.
- A fixed bottom "Prochaine station" bar with the train pictogram and a navy Continuer button.
- Flat surfaces; depth only for floating menus.

## Colors

A restrained transit palette: navy ink and enamel, one saturated line blue, one coral signal, and pale blue-grey tints for plaques and hairlines.

### Primary
- **Ligne Bleu Électrique** (metro-blue): the line itself and everything that belongs to it: the 12px menu trunk, the 3-6px secondary lines, station rings and filled markers, links, focus outlines, check marks, gauges, the outline buttons, pictograms, callout icons and labels.
- **Plaque Marine** (metro-navy): ink for all text on white, and the enamel fill of title plaques, highlights, streak and summary panels, avatar discs and the primary button. Deepens to **Marine Appuyé** (metro-navy-hover) on hover.

### Secondary
- **Corail "Vous êtes ici"** (metro-coral): reserved for the learner's current position: the current station ring and dot, the "Vous êtes ici" tag, the current stop on line maps and journey strips.

### Neutral
- **Fond Blanc** (ground): the page, sidebars, bottom bar, strips and line buttons.
- **Teinte Quai** (metro-tint): flat plaque fill for callouts, quiz intro, terminus panel, exercise answers, certificate rows, opened plan modules, and the hover fill of line buttons and menu items.
- **Pastille de Ligne** (metro-pill): the line pill ("Ligne X · Station n sur T") and the active learner-nav station.
- **Filet** (metro-hair): 1px separators and 1.5px card/strip borders.
- **Gris Signalétique** (metro-muted) and **Indigo Légende** (metro-meta): secondary text; metro-muted for captions, back links and empty states, metro-meta for subtitles and meta lines under station and formation names.
- **Ardoise** (metro-slate): the unfilled track of a gauge on a navy plaque.
- **Station Dormante** (metro-dormant, metro-dormant-bg): ring and fill of badges and new lines not yet reached.
- **Status** (status-success-*, status-warning-*): only for callout success/warning variants and quiz correct/wrong feedback, always with a pictogram and label.

### Named Rules
**The Single Signal Rule.** Coral marks the learner's position and nothing else: no coral buttons, links, headings or decoration. If a screen has no "you are here", it has no coral.

**The One Line Rule.** There is one blue. Everything that is part of the journey is drawn in metro-blue; no second accent hue enters the learner area. (Exception, carried as built: the level gauge on the navy summary plaque uses a lighter blue for contrast.)

**The Shape-Before-Color Rule.** Station state is carried by form (filled disc = done, hollow ring = to come, ring with core = interchange, coral ring = current, thick ring = terminus) plus a check or empty circle, never by color alone.

## Typography

**Display Font:** Winky Sans (with sans-serif), weights 600/700/800, via `--font-display`
**Body Font:** Martel Sans (with sans-serif), weights 400/600/700, via `--font-text`

**Character:** Winky Sans is the station signage: rounded, slightly warm, set heavy and tight. Martel Sans is the timetable you read: open, humanist, set large and loose.

### Hierarchy
- **Display** (800, 56-64px, 1, -0.02em): page titles of the dashboard and progression pages.
- **Plaque** (800, 46-50px, 1.05-1.12, balanced, centered on the lesson): the lesson or formation title on its navy plaque.
- **Headline** (800, 42-46px, 1.02, -0.01em): headings inside lesson content.
- **Title** (700-800, 21-34px, 1.05-1.15): section titles, strip and terminus titles, callout labels (26px, blue), button labels (19-22px, weight 600-700). Dashboard and progression section titles are 25px uppercase at 0.02em.
- **Signage** (700, 15-18.5px): module names on the line, the line pill, plan module titles.
- **Body** (400, 20px, 1.55, max 860px): lesson prose; lists 19px, callout text 21px.
- **Body small** (400-700, 14-18.5px): station titles (15px), meta, captions, quiz options (17px), next-station text (18.5px bold).
- **Label** (600, 12.5-13.5px): the "Vous êtes ici" tag and badge status chips only.

### Named Rules
**The Signage/Reading Split Rule.** Winky Sans names places (titles, plaques, lines, modules, buttons); Martel Sans carries everything that is read or scanned (prose, station titles, meta, tags). `body` defaults to Martel Sans (through `--font-jakarta`); signage elements declare Winky Sans explicitly.

**The Large Reading Rule.** Lesson prose never drops below 19px; the column is capped at 860px and indented 44px from headings and panels, like a guide column.

## Layout

Two columns on every learner page: a sticky full-height left menu and a main column. On the lesson page the menu is the formation line (`clamp(280px, 24.3vw, 380px)`); on the other learner pages it is the learner shell with a two-station nav line (`clamp(260px, 22.5vw, 350px)`). Both are white with a 1px hairline right edge, the `ahead_digital` wordmark at top (Winky Sans 800, 35px).

The lesson main column runs 60px top, 45px left, with the account menu absolutely positioned top right. Order: line pill, title plaque (12px below, min height 142px), content (32px below). Lesson blocks stack with a 26px gap; dashboard sections with 44px. The lesson and formation pages end with a fixed bottom bar (min height 94px, white, hairline top) offset by the sidebar width; content reserves 140-150px of bottom padding for it.

The formation page draws the whole line horizontally (stops as equal grid columns, labels rotated -38deg), then two columns: detailed plan and terminus panel (1.14fr / 1fr).

Spacing rhythm: 8 / 14 / 26 / 44px, with 18-24px inside panels and strips.

Responsive: not designed yet (second phase). The existing breakpoints (640px, 760px, 1100px, 1180px) only collapse individual grids and must not be read as a responsive system.

## Elevation & Depth

Flat by construction. Depth comes from tone: navy enamel plaques over white, light-blue tint plaques, and 1.5px hairline borders. Inset white rings (`box-shadow: inset 0 0 0 3-7px #fff`) are part of the marker vocabulary, not elevation.

### Shadow Vocabulary
- **Floating menu** (`box-shadow: 0 12px 32px rgba(23, 24, 59, 0.14)`): the account dropdown only.
- **Assistant launcher** (`box-shadow: 0 10px 28px rgba(29, 70, 229, 0.32)`): the floating formation assistant button, which sits above the bottom bar.

### Named Rules
**The Plaque Not Card Rule.** Panels at rest are plaques (tint or navy) or hairline-bordered rows; they never take a drop shadow. Shadows exist only for elements that float over the page.

## Shapes

Round markers on a rounded line, inside softly cornered plaques. The line is a thick bar with fully rounded ends (12px trunk, 6px radius); station markers are circles. Plaques and panels use 14px corners, buttons and strips 12px, secondary buttons 10px, the "Vous êtes ici" tag 6px, the line pill a full 17px pill. The copyable prompt is a ticket: its left edge is perforated by a repeating radial mask.

## Components

### Buttons
Heavy, enamel, signage-voiced.
- **Shape:** gently rounded (12px; 10px for the dashboard resume button).
- **Primary (Continuer, Reprendre, quiz start/submit, enroll):** navy fill, white Winky Sans 21-22px weight 600-700, 54-56px tall, 24-26px side padding, trailing arrow.
- **Hover / Focus:** fill deepens to navy-hover over 180ms `cubic-bezier(0.16, 1, 0.3, 1)`; the arrow slides 4px right. Focus is a 3px blue outline offset 3px.
- **Line (copy prompt, exercise toggle, board button):** white or transparent, 1.5px blue border, blue Martel Sans 15-16px bold (Winky on the board button), 42-46px tall; hover fills with metro-tint.
- **Disabled:** opacity 0.45-0.7, never a grey restyle.

### Chips
- **Line pill:** pale blue pill, blue Winky Sans 16-16.5px bold, segments separated by a 26-28px gap ("Ligne X", "Station n sur T · m min").
- **"Vous êtes ici" tag:** deep coral fill `--metro-coral-ink` #d63a40 (white text at 4.6:1, AA), white Martel Sans 13-13.5px semibold, 6px corners; on journey strips it floats above the stop with a pointer in the same colour. The brighter #ff555b stays for rings and markers, never under small white text.
- **Badge status:** dormant-bg chip with muted text; earned turns blue with white text.

### Cards / Containers
- **Title plaque:** navy, 14px corners, white Winky Sans 800, centered and balanced on the lesson, left-aligned with a two-line description on the formation page.
- **Callout:** metro-tint plaque, 14px corners, 50px blue pictogram column then blue Winky label (26px) and 21px text. The example variant lays out pictogram | 2px blue rule | label | text on one row. Warning and success variants switch to their status tint and ink.
- **Highlight / streak / summary:** navy enamel plaque with white text at 0.88-0.9 opacity for secondary lines.
- **Exercise:** white with a 1.5px blue border, navy disc pictogram.
- **Strips, rows, badge cards:** white, 1.5px hairline border, 12px corners, 18-26px padding. Certificate rows use the tint fill instead.
- **Feature grid:** a two-column list separated by hairlines, deliberately not cards.

### Inputs / Fields
- **Quiz option:** white, 1.5px hairline border, 12px corners, 17px Martel Sans, letter square in tint/blue. Hover turns the border blue; selected inverts to navy with a blue letter square; correct/wrong use status tints with a pictogram; a missed answer gets a dashed green border.

### Navigation
- **Formation line (lesson menu):** a 12px blue trunk from first module to terminus. Modules are interchanges (Winky 16.5px bold names, Martel subtitles in metro-meta); only the current module expands its stations onto a thinner 3px branch. Stations are Martel 15px, bold when current. Right column carries a blue check (done) or an empty grey circle (to come). Hover turns names blue. The current station scrolls into view on load.
- **Learner shell nav:** a short 6px line with two stations ("Mes formations", "Ma progression"), Winky 21px; the active item gets a pale blue pill, weight 800 and a filled marker. Account menu and notification bell sit at the bottom above a hairline.
- **Account menu:** navy avatar disc and name; dropdown is a white 12px panel with hairline border and the floating-menu shadow; items hover to tint.

### Prochaine station bar (signature)
Fixed white bar at the foot of the lesson and formation pages: blue train pictogram (40px), a 2px blue vertical rule, "Prochaine station : {title} · {minutes}" in Martel 18.5px bold (time regular), and the primary button at right. At the end of the line it reads "Terminus : certificat".

### Line maps and journey strips (signature)
The same line redrawn at other scales: horizontal on the formation page (6px line, 34px stop rings, rotated labels, thicker terminus ring with flag label), compact inside each dashboard strip (3px line, 15px stops, 24px coral current stop with tag), and as dot rows (11px) in the formation plan. Station state always follows the Shape-Before-Color Rule.

### Pictograms
Custom line-drawn SVGs made for the world (train seen head-on on its rails, terminus flag with burst), drawn in `currentColor` at 2.6-3.4px strokes. Functional icons elsewhere are lucide-react outline icons.

### Motion
One signature gesture: on load, the current station marker scales from 0.4 to 1 and fades in (520ms, `cubic-bezier(0.16, 1, 0.3, 1)`, 180ms delay), followed by the "Vous êtes ici" tag (420ms, 420ms delay). Disabled under `prefers-reduced-motion`. Everything else is 160-220ms state transitions on the same curve.

## Do's and Don'ts

### Do:
- **Do** draw progress as the blue line with station markers, at whatever scale the surface needs (menu trunk, horizontal map, strip, dot row).
- **Do** put page and lesson titles on a navy plaque (14px corners) and secondary panels on metro-tint plaques.
- **Do** give every station state a distinct shape plus a check or empty circle, and a screen-reader status label.
- **Do** set lesson prose in Martel Sans at 19-21px, capped at 860px.
- **Do** end journey pages with the fixed "Prochaine station" bar and a single navy primary action.
- **Do** use `--metro-*` tokens for anything inside `/apprenant`.

### Don't:
- **Don't** use coral for anything other than the learner's current position.
- **Don't** introduce a second accent hue or a thin generic progress bar as the main expression of the journey; gauges are secondary readouts next to the line.
- **Don't** put drop shadows on panels at rest; shadows are for floating menus and the assistant launcher only.
- **Don't** read the legacy `--coral` token as coral: it is the accent blue. Real coral stays `--metro-coral` / `--metro-coral-ink`, for "Vous êtes ici" only.
- **Don't** treat the current breakpoints as a responsive design; phone layouts are a separate phase.

## Calm register (dashboard, progression) — added 2026-10-01

User feedback after the first release: the overview pages felt "too marked", less like a modern SaaS. The formation and lesson pages keep the full signage register; the overview pages use a calm register of the same world:

- **Brand mark:** the real Ahead Digital logo (`components/learner/AheadLogo.tsx`, vector from aheaddigital.com; text in currentColor, underscore in the brand coral #EA565F — the one coral use outside "Vous êtes ici", as part of the mark).
- **Navigation:** a plain icon list (GraduationCap, TrendingUp), Martel Sans 16px semibold, active item on a #eef2fc pill with a blue icon. No line in the menu (a two-stop line read as unfinished).
- **Type:** page titles Winky Sans 38px/700, section titles 21px/700 in sentence case (no uppercase), meta in Martel Sans 14px muted.
- **Formation cards:** cover image (or the generated cover) at 16:7, 14px corners, 1px hairline, soft hover shadow; the metro line survives as a thin track (2px, 9px stops, coral ring for the current module).
- **Badges:** 60px medallions without rings; earned = navy disc, locked = #f1f3f9.
- **Summaries:** light #f7f9fe panel with hairline instead of the navy plaque; wording says "leçons", not "stations".

### Admin areas (company admin, super admin) — added 2026-10-01

Same calm register, applied on user request ("applique ces changements à la vue admin entreprise et super admin"):
- **Shell:** `WorkspaceShell` (shared with the learner area). It has the Ahead Digital logo, an identity card under the logo (company and role, or "Ahead Digital · Super admin"), the icon navigation and, at the bottom, the account and notifications. There is no top bar. The content sits on `--bg` #f6f7fb so white cards read.
- **Pages:** no eyebrow labels above titles; display weights capped at 700; accent blue for primary actions.

### Access pages (sign-in, sign-up, invitation, company creation) — added 2026-10-02
- **Frame:** `app/(auth)/layout.tsx`. The left side is a navy enamel panel with the Ahead Digital logo, one headline, one supporting line, a short section of metro line (the coral ring marks « Vous êtes ici ») and the copyright. The right side is the form column, 420px max, on white.
- **Clerk widget:** `lib/clerkAppearance.ts`, applied once on `<ClerkProvider>`.
  - It uses `elevation: "flush"`, so there is no card.
  - Colours: accent blue, navy text, Martel Sans, Winky Sans titles, 10px radius.
  - The primary button is flat: no gradient, no shadow.
  - The input border is set in `auth.module.css`, because Clerk renders `colorBorder` at about 11 % opacity.
- **Language:** Clerk's French translation, with app vocabulary: « entreprise », not « organisation ».
- **Custom invitation flow:** `AcceptInvitationFlow` copies the widget's look: display-face title, 44px inputs, flat blue button.
