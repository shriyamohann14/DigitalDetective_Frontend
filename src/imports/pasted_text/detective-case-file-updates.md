Add the following to the existing detective case-file app. Do NOT change any existing color palette, fonts, border-radius (sharp corners only), or the layout structure of already-built screens (splash, main-menu, case-select, investigation, headquarters, notebook, evidence-wall, case-resolution, records, settings, recruitment-letter, profile-creation).
DESIGN TOKENS TO REUSE EXACTLY:

Base background: #07090f
Body font: 'Courier Prime', monospace. Titles/stamps: 'Special Elite', serif
Amber: #c9a227 (borders/active), #ffd966 (bright highlight/glow)
Cyan: #00e9ff. Red: #ff3b3b / #ef4444. Green: #00ff6a
Dim secondary text: #b8a878 / #c9b882
Borders: 1px, rgba(201,162,39, 0.15–0.5), sharp corners only
Reuse existing Grain/ScanLines/Vignette atmosphere layers, amber-glow pulse, cyan-flicker, dot-pulse red indicator — do not invent new effects for these

1. HEADQUARTERS — EXTEND EXISTING SCREEN (don't rebuild layout)
Keep the existing HeadquartersScreen corkboard layout. Add, using the same visual language already present:

Current rank + XP + coins readout (stat row, Courier Prime, same style as existing "STATUS/NIGHT/LEADS/SUSPECTS" rows)
Navigation tiles/buttons to: Mission Board (case-select), Notebook, Handbook (new), Evidence Wall, Profile (new), Settings — styled as existing folder-tab buttons
Locked department tiles: same "locked" dim treatment (opacity ~0.4, no interaction) already used for locked mission cards
Small daily-notification badge (red dot-pulse, reuse existing .dot-pulse class) on the Mission Board tile when a new case is available

2. NEW SCREEN — DETECTIVE RECORDS
Same background system, styled like the existing Notebook screen (reuse its card/list pattern exactly — bordered entries, left-accent-color bar).
Sections, populated as missions are completed:

Investigation Techniques
Warning Signs
Verification Checklists
Key Concepts
Memory Tips
Real-Life Application Tips

Each entry: short title + 1–2 line description, unlocked/greyed states matching the existing locked-mission dimming pattern. Scrollable list, same scrollbar styling as Notebook.
3. NEW SCREEN — PLAYER PROFILE
Same background system, styled like the existing "records" stub screen but fully built out. Use the same stat-row and bordered-panel patterns from Headquarters:

Detective name, rank, avatar
XP total, coins, cases completed, average investigation score (reuse the category-score bar style from the Investigation Report)
Achievements grid (bordered badge tiles, amber/cyan/green accent per tier, sharp corners)
Skill cards (one per MIL skill mastered, same card style as Notebook items)
Promotion progress bar (same track-fill gradient style already used elsewhere, e.g. rank-track-fill)

4. EVIDENCE WALL — EXTEND EXISTING SCREEN
Keep the existing EvidenceWallScreen layout and cork-texture background exactly as built. Add:

Each completed mission pins one new clue card to the board (same pinned-note visual style already used)
Red string connections between related clues (reuse the same red-string treatment already present, e.g. from HQ corkboard)
Subtle "story progression" indicator (small percentage/stage counter in the existing Courier Prime dim-label style) showing how much of the overarching Shadow Network conspiracy has been uncovered

5. MAIN MENU — MAKE THE BACKGROUND INTERACTIVE & LIVE (visual only, no layout changes)
The current main-menu background is too flat/static. Without touching layout, panel positions, fonts, or colors of the existing menu, upgrade the background layer itself into an animated, detective-themed scene:

Do NOT blur any background elements — keep everything crisp/in-focus, just dimmed via the existing vignette/opacity treatment so foreground panels stay readable
Add subtle idle animation to the background: slow parallax drift on scattered case-file elements, a faint sway on hanging photos/notes, a slow-pan flicker on the desk-lamp glow already implied by the amber tones
Populate the background with more detective-desk elements consistent with the existing scattered case-file/photo props already visible: additional case folders, red string trailing between pinned photos, a magnifying glass, fingerprint cards, a rotary phone or radio, coffee mug ring stains, an evidence tag, a typewriter — all rendered in the same low-opacity dim/amber-tinted style already used for the existing background clutter (not full brightness, not blurred — same dimming approach as current props, just more of them and animated)
Reuse existing scan-line and grain layers over this animated background; no new visual effect systems beyond animating existing static elements (position/opacity/rotation transitions only)
Keep frame rate light — CSS/SVG transform animations only, no new animation library beyond what's already imported

NAVIGATION:
Extend the Screen type with: "handbook" | "profile". Wire these into the Headquarters navigation tiles added above. Use the existing screen-switching pattern already in App.tsx — no new routing library, no new animation library beyond what's already imported.