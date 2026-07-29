Update the "Digital Detective" noir case app with 5 changes. Keep the exact
existing visual language: Special Elite for headers, Courier Prime for UI
text, Caveat for handwritten notes, amber (#c9a227/#ffd966), cyan
(#00e9ff), red (#e74c3c) accents, film grain + scanlines + vignette
overlays. Do not redesign what already works — extend it.

────────────────────────────────────────
1. GLOBAL BACK NAVIGATION
────────────────────────────────────────
The in-game header (visible on investigation / headquarters / notebook /
evidence-wall) currently has no way back to the main menu — only the
Records/Settings stub screens have a working back button.

- Add a "← BUREAU" back arrow as the leftmost element in the header, before
  the case stamp. Same treatment as the existing StubScreen back button:
  Special Elite 14px, amber border, amber-glow text-shadow on hover.
- Clicking it returns to Main Menu and persists current progress (see
  section 5 for what "progress" means) — it must NOT reset the active case.
- Apply the same back arrow, left-aligned, to the Notebook screen (currently
  it's a modal-like leather book with no explicit exit — closing it should
  return to whichever screen the player opened it from, defaulting to
  Headquarters).
- Keep it out of the way on Evidence Wall specifically while the countdown
  timer is under 5 minutes (critical state) — grey it out with a tooltip
  "FINISH OR ABANDON THEORY" rather than hiding it, so navigation is never
  silently blocked.

────────────────────────────────────────
2. MAIN MENU BACKGROUND — CORK BOARD
────────────────────────────────────────
Main menu currently sits on a flat #07090f background. Reuse the corkboard
treatment already built for HeadquartersScreen and EvidenceWallScreen:

- Base: linear-gradient(135deg, #191008 0%, #140e06 100%) with the dotted
  radial-gradient cork-grain pattern (16–18px tile) already used there.
- Scatter 5–6 decorative pinned items behind the menu column at low opacity
  (0.12–0.18) and slight blur (1px) so they read as background, not
  interactive elements: a case photo, a torn newspaper clipping, a coiled
  red string fragment, a fingerprint card. Push-pin dot on each, same style
  as CORK_ITEMS cards.
- Add 2–3 faint red string SVG lines connecting some of these background
  pins, matching WALL_STRINGS styling but at ~15% opacity — pure atmosphere,
  no click targets.
- Keep the vignette overlay on top so the texture never competes with
  foreground text. The left/right decorative columns and the menu button
  column need a subtle semi-opaque scrim (rgba(7,9,15,0.55) backdrop) behind
  their content so text contrast stays WCAG-AA against the busier
  background — do not let cork texture reduce legibility of menu labels.

────────────────────────────────────────
3. "NEW CASE" → CASE FILE SELECT SCREEN (each case file = one level)
────────────────────────────────────────
Today MENU_ITEMS' "NEW CASE" jumps straight into Headquarters with the
hardcoded case 2024-1147. Replace that with a new screen: Case Select.

- New screen id: "case-select". Reached only from Main Menu → NEW CASE.
- Layout: corkboard background (reuse section 2's texture), grid of manila
  case-file folders — one per level. Source the list from the same data
  already shown in Main Menu's "RECENT CASES" column, extended into a full
  roster, e.g.:
    - CASE 2024-1147 · THE MERIDIAN INCIDENT — AVAILABLE / IN PROGRESS
    - CASE 2024-0891 · HARBOR PHANTOM — LOCKED ("SOLVE MERIDIAN INCIDENT TO UNLOCK")
    - CASE 2023-1204 · MISSING LEDGER — LOCKED
  (Add 1–2 more placeholder locked cases for a believable "level list" —
  label them CLASSIFIED with no title revealed until unlocked.)
- Each folder card shows: case ID stamp, title, a one-line teaser, a status
  badge (AVAILABLE / IN PROGRESS / CLOSED — SOLVED / CLOSED — COLD / LOCKED),
  and for locked cards a diagonal "CLASSIFIED" stamp overlay with reduced
  opacity + non-interactive cursor.
- Click on an unlocked, not-yet-started case → confirmation micro-dialog
  ("OPEN CASE FILE 2024-1147?") → starts a fresh investigation for that
  case → navigates to Headquarters.
- Click on a locked card → subtle shake animation, no navigation.
- Click on an in-progress case here should behave the same as CONTINUE
  (resume, not restart) — do not let New Case accidentally wipe progress.
- Back arrow (top-left, same style as section 1) returns to Main Menu.

────────────────────────────────────────
4. "CONTINUE" — RESUME THE ACTIVE CASE ONLY
────────────────────────────────────────
Right now CONTINUE targets the same hardcoded Headquarters screen as NEW
CASE — functionally identical, which is misleading.

- CONTINUE must only resume a case that is actually IN PROGRESS. It skips
  Case Select entirely and drops the player back into the exact screen
  they left (Headquarters / Investigation / Notebook / Evidence Wall),
  with their prior tab, tool, and evidence-wall selections intact.
- If there is no in-progress case, disable the CONTINUE button visually
  (reduced opacity, muted border, not clickable) and change its sub-label
  to "NO ACTIVE INVESTIGATION" instead of the current hardcoded
  "RESUME · NIGHT 4 · DOCK 7 INCIDENT" — never show a resumable-looking
  button that leads nowhere real.

────────────────────────────────────────
5. COMPLETE "THE MERIDIAN INCIDENT" END-TO-END
────────────────────────────────────────
This case currently has no ending: EvidenceWallScreen's "SUBMIT THEORY"
button has no click handler, and its 847s countdown resets every time the
screen unmounts/remounts because it's local component state. Close the
loop:

a) Evidence Wall interaction:
   - Make WALL_NODES clickable. Clicking a suspect-colored node (AMES,
     SOLANO, FONTAINE) "circles" it as the player's prime-suspect selection
     (red marker ring, same visual language as the pushpin glow).
   - SUBMIT THEORY is disabled until a suspect node is selected.

b) On submit, compare selection to the correct suspect (K. SOLANO — already
   flagged in the footer copy) and branch into a new "case-resolution"
   screen:
   - CORRECT → success variant: large "CASE CLOSED" stamp (reuse
     StampOverlay's spring-in stamp animation, green palette), a short
     typewriter-effect epilogue paragraph, and a stats readout (time
     remaining, evidence reviewed, verdicts recorded).
   - INCORRECT or timer hits 0:00 → failure variant: "CASE UNRESOLVED"
     stamp (red palette), epilogue implying the trail went cold, with two
     actions — "REVIEW EVIDENCE" (only if time remains, returns to Evidence
     Wall) or "CLOSE — MARK COLD" (ends the case as failed).
   - Both variants end with a single primary CTA: "RETURN TO BUREAU" →
     Main Menu.

c) Reflect the outcome back in Main Menu / Case Select: CASE 2024-1147's
   status badge updates to CLOSED (green if solved, muted red if cold), and
   CONTINUE becomes disabled again since there's no active case until the
   player opens a new one from Case Select.

d) Fix the countdown timer's lifecycle: it must live in the lifted case
   state (see below), not in EvidenceWallScreen's local useState, so
   leaving and returning to Evidence Wall via the back arrow or tab nav
   pauses/resumes correctly instead of resetting to 847.

────────────────────────────────────────
STATE MODEL (implement this to support 3–5 correctly)
────────────────────────────────────────
Lift a single active-case object above the four gameplay screens (top-level
in App, or a small context) instead of each screen owning isolated state:

  {
    caseId, title, status: "available" | "in-progress" | "closed-solved" | "closed-cold" | "locked",
    lastScreen: Screen,
    activeTab, activeTool,
    verdictsGiven: Verdict[],
    wallSelection: number | null,
    timeRemainingSec
  }

Persist it (localStorage is fine) so CONTINUE survives a refresh, and so
Main Menu's "RECENT CASES" / Case Select's status badges always read from
this one source of truth instead of hardcoded arrays.