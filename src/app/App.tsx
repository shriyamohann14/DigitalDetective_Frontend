import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RecruitmentIntro } from "./components/RecruitmentIntro";

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = "boot" | "splash" | "recruitment-letter" | "profile-creation" | "mira-onboarding" | "main-menu" | "case-select" | "mission-briefing" | "investigation" | "notebook" | "evidence-wall" | "case-resolution" | "records" | "settings" | "profile";
type Tool = "scanner" | "timeline" | "camera" | "emotion" | "bias" | "metadata" | "verify" | null;
type Verdict = "TRUST" | "VERIFY" | "REJECT" | "REPORT" | null;
type CaseStatus = "available" | "in-progress" | "closed-solved" | "closed-cold" | "locked";
interface DiscoveredFinding { elementId: string; toolId: string; text: string; }
interface CaseRecord {
  caseId: string; status: CaseStatus; lastScreen: Screen;
  verdictsGiven: Verdict[]; wallSelection: number | null; timeRemainingSec: number;
  finalVerdict: Verdict; notebookNotes: string;
  discoveredFindings: DiscoveredFinding[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const TOOLS_DATA = [
  {
    id: "scanner" as const, sym: "◎", label: "SOURCE SCANNER", color: "#00bfff",
    result: "ACCOUNT AGE: 94 DAYS\nFOLLOWERS: 2,400 — UNVERIFIED\nVERIFIED BADGE: NONE\nPRIOR FLAGS: 2",
  },
  {
    id: "timeline" as const, sym: "⊞", label: "TIMELINE LENS", color: "#c9a227",
    result: "POST PUBLISHED: 06:14\n500 SHARES BY: 08:00\nFIRST FLAG: 09:45\nSPREAD RATE: ACCELERATING",
  },
  {
    id: "camera" as const, sym: "◈", label: "CONTEXT CAMERA", color: "#9b59b6",
    result: "PLATFORM: SOCIAL FEED\nTAGS: #health #cure #share\nSIMILAR POSTS: 4 DETECTED\nORIG SOURCE: UNVERIFIED",
  },
  {
    id: "emotion" as const, sym: "◉", label: "EMOTION METER", color: "#e74c3c",
    result: "HEADLINE TONE: FEAR/URGENCY\nEMOJI USAGE: EXCESSIVE\nCLICKBAIT SCORE: HIGH\nLANGUAGE BIAS: LOADED",
  },
  {
    id: "bias" as const, sym: "◐", label: "BIAS COMPASS", color: "#22c55e",
    result: "FRAMING: FEAR-BASED\nEMOTION LOAD: HIGH\nNEUTRALITY INDEX: 0.14\nPRIM LEAN: HEALTH FEAR",
  },
  {
    id: "metadata" as const, sym: "◫", label: "METADATA LENS", color: "#9b59b6",
    result: "POSTED: 06:14:08 AM\nACCOUNT AGE: 94 DAYS\nPRIOR POSTS: 38\nLOCATION: HIDDEN",
  },
  {
    id: "verify" as const, sym: "◻", label: "VERIFY CHECKLIST", color: "#c9b882",
    result: "SOURCE CITED: UNVERIFIED SITE\nEXPERT REVIEW: NONE\nPEER-REVIEWED: NO\nFACT-CHECKED: DISPUTED",
  },
];

// ─── Dynamic tool findings for Case 2024-1147 ────────────────────────────────
// Keys are toolId → elementId → factual finding text (facts, not conclusions).
// Elements with no meaningful data for a tool fall through to _default.
const TOOL_FINDINGS: Record<string, Record<string, string>> = {
  scanner: {
    "handle":     "naturalheals.in domain registered 42 days ago · no author names listed · no editorial policy · no contact page",
    "engagement": "account age: 94 days · prior health-claim flags: 2 · engagement rate inconsistent with follower count",
    "comment":    "commenter account created 61 days ago · no prior medical posts · comment upvoted within 18 minutes of posting",
    "_default":   "No source-related data for this selection.",
  },
  timeline: {
    "headline":    "post published 06:14 · 500 shares reached by 08:00 · spread rate logged as accelerating by monitoring tools",
    "engagement":  "124,532 likes accumulated over 14 hours · share-to-like ratio: 1:3.2 · first platform flag recorded at 09:45",
    "comment":     "comment posted 2 hours after original post · upvote burst pattern associated with coordinated engagement",
    "_default":    "No time-sequence data for this selection.",
  },
  camera: {
    "headline":        "identical headline text found on 4 separate accounts · earliest known version predates this account by 6 months",
    "claim-medicines": "identical bullet phrasing found in 6 prior posts across 3 platforms · no research citation found in any instance",
    "claim-effects":   "identical bullet phrasing found in 6 prior posts across 3 platforms · no research citation found in any instance",
    "claim-everyone":  "identical bullet phrasing found in 6 prior posts across 3 platforms · no research citation found in any instance",
    "claim-thousands": "identical bullet phrasing found in 6 prior posts across 3 platforms · no research citation found in any instance",
    "cta":             "'Share with loved ones' phrasing appears in 38 documented health-misinformation posts in the past 90 days",
    "handle":          "naturalheals.in links to a supplement product page · account promotes 2 other products with similar unverified claims",
    "_default":        "No cross-platform context data for this selection.",
  },
  emotion: {
    "headline":        "all-caps lettering · exclamation mark · '7 DAYS' adds artificial deadline · no hedging language present",
    "cta":             "family-based emotional appeal ('loved ones') · imperative verb 'Share' · no source reference included",
    "claim-medicines": "absolute term 'No' with no qualifiers · zero caveats · benefits-only language pattern",
    "claim-effects":   "absolute term 'No' with no qualifiers · zero caveats · benefits-only language pattern",
    "claim-everyone":  "universal claim 'Everyone' with no exceptions stated · no individual-variation acknowledgement",
    "claim-thousands": "vague large number ('thousands') with no source · designed to convey social proof without verifiable data",
    "_default":        "No emotional-language data for this selection.",
  },
  bias: {
    "headline":        "implies medical establishment suppresses a cure · no alternative perspective offered · uses fear framing",
    "cta":             "urgency framing positions sharing as a moral duty · no verification step suggested",
    "claim-medicines": "benefits-only presentation · no risk information · no exceptions or contraindications stated",
    "claim-effects":   "benefits-only presentation · no risk information · no exceptions or contraindications stated",
    "claim-everyone":  "benefits-only presentation · no risk information · no exceptions or contraindications stated",
    "claim-thousands": "social-proof framing without verifiable data · number functions as authority without citation",
    "handle":          "account name implies health authority · no commercial-interest disclaimer present",
    "_default":        "No framing data for this selection.",
  },
  metadata: {
    "handle":     "account age: 94 days · total posts: 38 · location data: hidden · no linked editorial team",
    "engagement": "post timestamp: 06:14:08 UTC · device metadata stripped from post · geolocation field absent",
    "_default":   "No metadata available for this selection.",
  },
  verify: {
    "headline":        "no peer-reviewed study found across 3 databases · claim listed as disputed by independent fact-checkers",
    "claim-medicines": "no clinical trial result found supporting this · closest published study found no statistically significant effect",
    "claim-effects":   "no clinical trial result found supporting this · closest published study found no statistically significant effect",
    "claim-everyone":  "no clinical trial result found supporting this · closest published study found no statistically significant effect",
    "claim-thousands": "no clinical trial result found supporting this · closest published study found no statistically significant effect",
    "handle":          "naturalheals.in not listed in any press or medical credibility database · domain registered via private registrar",
    "comment":         "commenter's claim is unverifiable · anecdotal personal report does not constitute clinical evidence",
    "_default":        "No verifiable data for this selection.",
  },
};

function getToolResult(toolId: string, elementId: string | null): string {
  if (!elementId) {
    // Default: normalise multi-line hardcoded result to · separator
    return TOOLS_DATA.find(t => t.id === toolId)?.result.replace(/\n/g, " · ") ?? "";
  }
  return TOOL_FINDINGS[toolId]?.[elementId] ?? TOOL_FINDINGS[toolId]?.["_default"] ?? "No relevant data for this selection.";
}

const WITNESS_DATA = [
  { id: 1, name: "@HEALTHTRUTH22", time: "06:14", role: "ORIGINAL POSTER — ANONYMOUS", statement: "Posted the claim with zero credentials: \"DOCTORS DON'T WANT YOU TO KNOW THIS 🚨\" Account is 94 days old. No real name. No bio. Two prior health-misinformation flags." },
  { id: 2, name: "@CURIOUS_MOM", time: "08:30", role: "COMMENT — BELIEVER", statement: "\"My aunt tried this last month and she says it really helped. Why would they lie to us?\" 847 likes on the comment. No source cited. Emotional appeal only." },
  { id: 3, name: "MED-ALERT BOT", time: "09:45", role: "AUTOMATED FLAG — FACT-CHECK DB", statement: "Health claim flagged across three independent fact-check databases. No peer-reviewed study found. Domain naturacurenews.net registered only 42 days ago." },
];

const EVIDENCE_DATA = [
  { id: 1, label: "VIRAL POST — SCREENGRAB", tag: "SOCIAL MEDIA", auth: 62, flagged: true },
  { id: 2, label: "POSTER'S ACCOUNT", tag: "ACCOUNT", auth: 38, flagged: true },
  { id: 3, label: "ORIGINAL SOURCE CHECK", tag: "SOURCING", auth: 12, flagged: true },
  { id: 4, label: "SCIENTIFIC EVIDENCE", tag: "RESEARCH", auth: 15, flagged: true },
  { id: 5, label: "EXPERT OPINION", tag: "EXPERT", auth: 91, flagged: false },
  { id: 6, label: "WEBSITE CREDIBILITY", tag: "DIGITAL", auth: 24, flagged: true },
];

const SUSPECT_DATA = [
  { id: 1, name: "@HEALTHTRUTH22", role: "Anonymous Poster — Account Age 94d", suspicion: 84 },
  { id: 2, name: "NATURACURENEWS.NET", role: "Source Website — No Contact Info", suspicion: 79 },
  { id: 3, name: "VITABOOST BRAND", role: "Supplement Brand — Potential Beneficiary", suspicion: 52 },
];

const TIMELINE_DATA = [
  { time: "06:14", event: "Viral post published — anonymous account", active: false },
  { time: "08:00", event: "500 shares reached — spread accelerating", active: false },
  { time: "09:45", event: "Fact-check bot flags the claim — 3 databases", active: true },
  { time: "12:00", event: "Post reaches 12,000 views — still live", active: false },
  { time: "14:30", event: "Medical association issues public warning", active: false },
  { time: "ONGOING", event: "Original post still live — no retraction", active: false },
];

// Suspect node IDs (gold nodes that can be nominated as primary source of misinformation)
const SUSPECT_NODE_IDS = [1, 3, 6]; // @HLTHTRUTH22, NATURACURE, SHARE CHAIN
const CORRECT_SUSPECT_ID = 1; // @HEALTHTRUTH22 — original anonymous poster

// ─── Case catalog & persistent state ─────────────────────────────────────────
const CASES_CATALOG = [
  { caseId: "2024-1147", title: "THE MIRACLE CURE", teaser: "A viral health claim. No source. An anonymous account. Someone wants this shared — but why?" },
  { caseId: "2024-0891", title: "HARBOR PHANTOM",        teaser: "Ships vanishing from the manifest. Someone is very good at math." },
  { caseId: "2023-1204", title: "MISSING LEDGER",        teaser: "The numbers were there. Now they aren't. Neither is the accountant." },
  { caseId: "2024-1389", title: "CLASSIFIED",            teaser: null },
  { caseId: "2024-1501", title: "CLASSIFIED",            teaser: null },
];

const INITIAL_CASES: CaseRecord[] = [
  { caseId: "2024-1147", status: "available",  lastScreen: "main-menu", verdictsGiven: [], wallSelection: null, timeRemainingSec: 847, finalVerdict: null, notebookNotes: "", discoveredFindings: [] },
  { caseId: "2024-0891", status: "locked",     lastScreen: "main-menu", verdictsGiven: [], wallSelection: null, timeRemainingSec: 847, finalVerdict: null, notebookNotes: "", discoveredFindings: [] },
  { caseId: "2023-1204", status: "locked",     lastScreen: "main-menu", verdictsGiven: [], wallSelection: null, timeRemainingSec: 847, finalVerdict: null, notebookNotes: "", discoveredFindings: [] },
  { caseId: "2024-1389", status: "locked",     lastScreen: "main-menu", verdictsGiven: [], wallSelection: null, timeRemainingSec: 847, finalVerdict: null, notebookNotes: "", discoveredFindings: [] },
  { caseId: "2024-1501", status: "locked",     lastScreen: "main-menu", verdictsGiven: [], wallSelection: null, timeRemainingSec: 847, finalVerdict: null, notebookNotes: "", discoveredFindings: [] },
];

function loadCases(): CaseRecord[] {
  try { const s = localStorage.getItem("dd_cases"); return s ? JSON.parse(s) : INITIAL_CASES; }
  catch { return INITIAL_CASES; }
}
function saveCases(cs: CaseRecord[]) {
  try { localStorage.setItem("dd_cases", JSON.stringify(cs)); } catch {}
}

// ─── Player profile ───────────────────────────────────────────────────────────
interface PlayerProfile {
  name: string; avatarId: number; badgeId: string; rank: string;
}
function loadProfile(): PlayerProfile | null {
  try { const s = localStorage.getItem("dd_profile"); return s ? JSON.parse(s) : null; }
  catch { return null; }
}
function saveProfile(p: PlayerProfile) {
  try { localStorage.setItem("dd_profile", JSON.stringify(p)); } catch {}
}

// ─── Style injection ──────────────────────────────────────────────────────────
const STYLES = `
  @keyframes needle-tremble {
    0%   { transform: rotate(-1.1deg); }
    30%  { transform: rotate(0.7deg);  }
    60%  { transform: rotate(-0.4deg); }
    85%  { transform: rotate(1.0deg);  }
    100% { transform: rotate(-0.8deg); }
  }
  @keyframes rain-fall {
    from { transform: translateY(-24px); opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 1; }
    to   { transform: translateY(110vh); opacity: 0; }
  }
  @keyframes amber-glow {
    0%, 100% { text-shadow: 0 0 4px rgba(201,162,39,0.5); }
    50%       { text-shadow: 0 0 14px rgba(201,162,39,0.9), 0 0 28px rgba(201,162,39,0.3); }
  }
  @keyframes clock-blink {
    0%,49%  { opacity: 1; }
    50%,100%{ opacity: 0.2; }
  }
  @keyframes dot-pulse {
    0%,100%{ box-shadow: 0 0 0 0 rgba(231,76,60,0.6); }
    50%    { box-shadow: 0 0 0 6px rgba(231,76,60,0); }
  }
  @keyframes cyan-flicker {
    0%,100%{ opacity:1; }
    91%{ opacity:1; }
    92%{ opacity:0.65; }
    94%{ opacity:1; }
    96%{ opacity:0.8; }
    98%{ opacity:1; }
  }
  @keyframes card-shake {
    0%,100% { transform: rotate(var(--rot,0deg)); }
    20% { transform: rotate(var(--rot,0deg)) translateX(-6px); }
    40% { transform: rotate(var(--rot,0deg)) translateX(6px); }
    60% { transform: rotate(var(--rot,0deg)) translateX(-4px); }
    80% { transform: rotate(var(--rot,0deg)) translateX(4px); }
  }
  @keyframes typewriter-cursor {
    0%,100%{ opacity:1; } 50%{ opacity:0; }
  }
  .needle-tremble  { animation: needle-tremble 0.45s ease-in-out infinite; }
  .rain-drop       { position:absolute; width:1px; animation: rain-fall linear infinite; }
  .amber-glow      { animation: amber-glow 2.4s ease-in-out infinite; }
  .clock-colon     { animation: clock-blink 1s step-end infinite; }
  .dot-pulse       { animation: dot-pulse 2s ease-in-out infinite; }
  .cyan-flicker    { animation: cyan-flicker 5s ease-in-out infinite; }
  .card-shake      { animation: card-shake 0.38s ease; }
  .tw-cursor       { animation: typewriter-cursor 0.7s step-end infinite; }
  /* ── Animated menu background ── */
  @keyframes mbg-glass-drift {
    0%,100% { transform: translateX(-60px); }
    50%     { transform: translateX(60px);  }
  }
  @keyframes mbg-folder-float {
    0%,100% { transform: rotate(var(--f-rot,0deg)) translateY(0px);    }
    50%     { transform: rotate(var(--f-rot,0deg)) translateY(-18px); }
  }
  @keyframes mbg-grid-pan {
    0%   { background-position: 0 0; }
    100% { background-position: 40px 40px; }
  }
  @keyframes mbg-string-pulse {
    0%,100% { opacity: 0.045; }
    50%     { opacity: 0.10;  }
  }
  .mbg-glass-drift   { animation: mbg-glass-drift 22s ease-in-out infinite; }
  .mbg-folder-float  { animation: mbg-folder-float 15s ease-in-out infinite; }
  .mbg-grid-pan      { animation: mbg-grid-pan 28s linear infinite; }
  .mbg-string-pulse  { animation: mbg-string-pulse 12s ease-in-out infinite; }
  /* ── Foreground menu panel ── */
  @keyframes title-breathe {
    0%,100% { opacity: 0.88; }
    50%     { opacity: 1; }
  }
  @keyframes tile-border-flicker {
    0%,100% { opacity: 1; }
    18%     { opacity: 0.28; }
    34%     { opacity: 1; }
    52%     { opacity: 0.62; }
    66%     { opacity: 1; }
  }
  @keyframes tile-scan-pass {
    from { transform: translateY(-100%); }
    to   { transform: translateY(250%); }
  }
  .tile-border-flicker { animation: tile-border-flicker 0.34s ease; }
  .tile-scan-active    { animation: tile-scan-pass 0.62s linear; }
  /* ── Scene / tile depth ── */
  @keyframes scene-drift {
    0%,100% { transform: translateY(0px);  }
    50%     { transform: translateY(-3px); }
  }
  @keyframes tile-amber-box-glow {
    0%,100% { box-shadow: 0 4px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,217,102,0.06); }
    50%     { box-shadow: 0 4px 16px rgba(0,0,0,0.55), 0 0 20px rgba(201,162,39,0.22), inset 0 1px 0 rgba(255,217,102,0.06); }
  }
  @keyframes op-cursor-blink {
    0%,49%  { opacity: 1; }
    50%,100%{ opacity: 0; }
  }
  @keyframes lamp-hot {
    0%   { opacity: 0.065; }
    14%  { opacity: 0.10;  }
    29%  { opacity: 0.05;  }
    47%  { opacity: 0.11;  }
    63%  { opacity: 0.07;  }
    81%  { opacity: 0.12;  }
    100% { opacity: 0.065; }
  }
  .scene-drift         { animation: scene-drift 21s ease-in-out infinite; }
  .tile-amber-box-glow { animation: tile-amber-box-glow 3s ease-in-out infinite; }
  .op-cursor-blink     { animation: op-cursor-blink 1.1s step-end infinite; }
  .lamp-hot            { animation: lamp-hot 4.2s ease-in-out infinite; }
  @keyframes mbg-pin-sway {
    0%,100% { transform: rotate(var(--f-rot,0deg)) translateY(0px); }
    33%     { transform: rotate(calc(var(--f-rot,0deg) + 1.8deg)) translateY(-6px); }
    66%     { transform: rotate(calc(var(--f-rot,0deg) - 1.2deg)) translateY(-3px); }
  }
  @keyframes scanline-sweep {
    0%   { background-position: 0 0; }
    100% { background-position: 0 100vh; }
  }
  .mbg-pin-sway { animation: mbg-pin-sway 18s ease-in-out infinite; }
  .scanline-sweep { animation: scanline-sweep 8s linear infinite; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: rgba(201,162,39,0.25); }
  ::-webkit-scrollbar-track { background: transparent; }
`;

function StyleInjector() {
  return <style dangerouslySetInnerHTML={{ __html: STYLES }} />;
}

// ─── Atmospherics ─────────────────────────────────────────────────────────────
function Grain() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[110] select-none"
      style={{
        opacity: 0.045,
        backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/></filter><rect width='256' height='256' filter='url(%23n)'/></svg>")`,
        mixBlendMode: "screen" as React.CSSProperties["mixBlendMode"],
      }}
    />
  );
}

function ScanLines() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[109] select-none"
      style={{
        background: "repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.16) 3px, rgba(0,0,0,0.16) 4px)",
      }}
    />
  );
}

function Vignette() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[108] select-none"
      style={{
        background: "radial-gradient(ellipse 78% 78% at 50% 44%, transparent 22%, rgba(2,4,14,0.96) 100%)",
      }}
    />
  );
}

// ─── Suspicion Dial ───────────────────────────────────────────────────────────
function SuspicionDial({ value }: { value: number }) {
  const cx = 70, cy = 80, r = 48, needleLen = 39;

  // Arc: 150° (8-o'clock) → 30° (4-o'clock) clockwise through 270° (12-o'clock)
  const deg2rad = (d: number) => (d * Math.PI) / 180;

  const arcPath = (sd: number, ed: number) => {
    const s = deg2rad(sd), e = deg2rad(ed);
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const cw = ((ed - sd) + 360) % 360;
    const large = cw > 180 ? 1 : 0;
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };

  // 240° total sweep. Thirds: 150→230→310→30(=390°)
  const needleDeg = 150 + (value / 100) * 240;
  const needleRad = deg2rad(needleDeg);
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  const needleColor = value > 66 ? "#ff4d4d" : value > 33 ? "#f5b942" : "#00ff6a";

  return (
    <div className="flex flex-col items-center pb-3">
      <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", letterSpacing: "0.22em", color: "#ffe6a8", marginBottom: "4px" }}>
        SUSPICION INDEX
      </div>
      <svg width="140" height="105" viewBox="0 0 140 105">
        <defs>
          <linearGradient id="arcGreenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient id="arcAmberGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#d97b0a" />
          </linearGradient>
          <linearGradient id="arcRedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>
        <path d={arcPath(150, 230)} fill="none" stroke="url(#arcGreenGrad)" strokeWidth="7" strokeLinecap="round" />
        <path d={arcPath(230, 310)} fill="none" stroke="url(#arcAmberGrad)" strokeWidth="7" strokeLinecap="round" />
        <path d={arcPath(310, 390)} fill="none" stroke="url(#arcRedGrad)" strokeWidth="7" strokeLinecap="round" />
        {[0, 25, 50, 75, 100].map((v) => {
          const d = deg2rad(150 + (v / 100) * 240);
          return (
            <line key={v}
              x1={(cx + (r - 5) * Math.cos(d)).toFixed(1)}
              y1={(cy + (r - 5) * Math.sin(d)).toFixed(1)}
              x2={(cx + (r + 4) * Math.cos(d)).toFixed(1)}
              y2={(cy + (r + 4) * Math.sin(d)).toFixed(1)}
              stroke="#ffffff" strokeWidth="1.5"
            />
          );
        })}
        <g className="needle-tremble" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <line
            x1={cx} y1={cy}
            x2={nx.toFixed(1)} y2={ny.toFixed(1)}
            stroke={needleColor} strokeWidth="2.5" strokeLinecap="round"
          />
          <line
            x1={cx} y1={cy}
            x2={(cx - (nx - cx) * 0.22).toFixed(1)}
            y2={(cy - (ny - cy) * 0.22).toFixed(1)}
            stroke={needleColor} strokeWidth="3" strokeLinecap="round" opacity={0.35}
          />
        </g>
        <circle cx={cx} cy={cy} r="5.5" fill={needleColor} />
        <circle cx={cx} cy={cy} r="3" fill="#07090f" />
        <text x={cx} y="99" textAnchor="middle" fill={needleColor}
          fontSize="11" fontFamily="Courier Prime, monospace" fontWeight="bold">
          {value}
        </text>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", width: "110px", fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#e8dcc0" }}>
        <span>LOW</span><span>MED</span><span>HIGH</span>
      </div>
    </div>
  );
}

// ─── Stamp overlay ────────────────────────────────────────────────────────────
const STAMP_PALETTE: Record<string, { bg: string; color: string }> = {
  TRUST:  { bg: "#06170d", color: "#00ff6a" },
  VERIFY: { bg: "#150f03", color: "#f59e0b" },
  REJECT: { bg: "#160404", color: "#ef4444" },
  REPORT: { bg: "#021620", color: "#00e9ff" },
};

function StampOverlay({ verdict, onDone }: { verdict: Verdict; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2100);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!verdict) return null;
  const p = STAMP_PALETTE[verdict];

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 200, backgroundColor: "rgba(0,0,0,0.9)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        initial={{ scale: 4.5, rotate: -14, opacity: 0 }}
        animate={{ scale: 1, rotate: -7, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ type: "spring", stiffness: 550, damping: 20, mass: 1.3 }}
        style={{
          fontFamily: "Special Elite, serif",
          fontSize: "clamp(4rem, 13vw, 10rem)",
          color: p.color,
          border: `10px solid ${p.color}`,
          padding: "0.25em 0.7em",
          backgroundColor: p.bg,
          letterSpacing: "0.14em",
          lineHeight: 1,
          boxShadow: `0 0 80px ${p.color}55, inset 0 0 40px ${p.color}18`,
        }}
      >
        {verdict}
      </motion.div>
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
        style={{ fontFamily: "Courier Prime, monospace", color: "#6b5f42", fontSize: "9px", letterSpacing: "0.22em" }}
      >
        VERDICT RECORDED — CASE FILE UPDATED
      </div>
    </motion.div>
  );
}

// ─── Gadget belt ──────────────────────────────────────────────────────────────
function GadgetBelt({ activeTool, onSelect, selectedElement }: { activeTool: Tool; onSelect: (t: Tool) => void; selectedElement: string | null }) {
  return (
    <div className="flex flex-col h-full" style={{ borderLeft: "1px solid rgba(201,162,39,0.2)" }}>
      <div className="px-3 py-2" style={{ borderBottom: "1px solid rgba(201,162,39,0.2)" }}>
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", letterSpacing: "0.25em", color: "#e6d9ac" }}>
          INVESTIGATOR&apos;S KIT
        </div>
      </div>

      <div className="flex flex-col gap-2 p-2 flex-1">
        {TOOLS_DATA.map((tool) => {
          const active = activeTool === tool.id;
          const result = getToolResult(tool.id, selectedElement);
          const isDim = result === "No relevant data for this selection." || result.startsWith("No ");
          return (
            <button
              key={tool.id}
              onClick={() => onSelect(active ? null : tool.id)}
              className="text-left transition-all"
              style={{
                border: `1px solid ${active ? tool.color : "rgba(201,162,39,0.22)"}`,
                backgroundColor: active ? `${tool.color}10` : "rgba(8,10,18,0.8)",
                padding: "9px 10px",
                cursor: "pointer",
              }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span style={{ fontSize: "9px", color: tool.color, fontFamily: "Courier Prime, monospace", lineHeight: 1 }}>
                  {tool.sym}
                </span>
                <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", letterSpacing: "0.12em", color: active ? tool.color : "#d8c88a" }}>
                  {tool.label}
                </span>
              </div>
              {active && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: isDim ? `${tool.color}60` : tool.color, lineHeight: 1.9, marginTop: "6px", fontStyle: isDim ? "italic" : "normal" }}
                >
                  {result.split(" · ").map((line, i) => <div key={i}>{line}</div>)}
                </motion.div>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3" style={{ borderTop: "1px solid rgba(201,162,39,0.18)" }}>
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#a89968", letterSpacing: "0.12em", lineHeight: 1.8 }}>
          CASE NO. 2024-1147<br />
          DETECTIVE: R. CHEN<br />
          STATUS: ACTIVE
        </div>
      </div>
    </div>
  );
}

// ─── Evidence exhibit modal ───────────────────────────────────────────────────
const EVIDENCE_EXHIBITS: Record<number, {
  type: string; title: string; body: React.ReactNode; marginNote?: string; mentorNote?: string;
}> = {
  1: {
    type: "SOCIAL MEDIA EXHIBIT",
    title: "VIRAL POST — SCREENGRAB",
    mentorNote: "No name, no date, no credentials — that's your first red flag, Recruit.",
    body: (
      <div>
        <div style={{ border: "1px solid rgba(201,162,39,0.2)", backgroundColor: "rgba(7,9,15,0.8)", padding: "12px", marginBottom: "12px" }}>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(201,162,39,0.4)", letterSpacing: "0.15em", marginBottom: "6px" }}>POST CONTENT — SCREENGRAB</div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#ffd966", lineHeight: 1.7, borderLeft: "2px solid rgba(201,162,39,0.3)", paddingLeft: "10px" }}>
            "DOCTORS DON'T WANT YOU TO KNOW THIS 🚨 Ancient herb CURES ALL diseases — even ones Big Pharma said were impossible. SHARE before they delete this!!!"
          </div>
        </div>
        {[["SHARES", "38,400 IN 6H"], ["LIKES", "12,100"], ["COMMENTS", "2,840 — MOSTLY UNCRITICAL"], ["AUTHOR", "UNKNOWN — NO CREDENTIALS"], ["SOURCE LINK", "NATURACURENEWS.NET"]].map(([k, v]) => (
          <div key={k} className="flex gap-2 mb-2">
            <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(201,162,39,0.5)", letterSpacing: "0.12em", minWidth: "90px" }}>{k}</span>
            <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: (k === "AUTHOR" || k === "SOURCE LINK") ? "#e74c3c" : "#c9b882" }}>{v}</span>
          </div>
        ))}
        <div style={{ height: "1px", backgroundColor: "rgba(201,162,39,0.15)", margin: "10px 0" }} />
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#e74c3c", lineHeight: 1.7 }}>
          FLAG: No author identified. No date on original claim. No institutional affiliation. Emotional language designed to trigger rapid sharing.
        </div>
      </div>
    ),
  },
  2: {
    type: "ACCOUNT DOSSIER",
    title: "POSTER'S ACCOUNT — @HEALTHTRUTH22",
    mentorNote: "94 days old. Thousands of followers. Growth like that doesn't happen organically.",
    body: (
      <div>
        <div style={{ border: "1px solid rgba(201,162,39,0.2)", padding: "10px", marginBottom: "12px", backgroundColor: "rgba(201,162,39,0.04)" }}>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(201,162,39,0.5)", letterSpacing: "0.15em", marginBottom: "4px" }}>ACCOUNT RECORD</div>
          <div style={{ fontFamily: "Special Elite, serif", fontSize: "20px", color: "#ffd966", letterSpacing: "0.06em" }}>@HEALTHTRUTH22</div>
        </div>
        {[["ACCOUNT AGE", "94 DAYS"], ["FOLLOWERS", "2,400"], ["FOLLOWING", "1,800"], ["VERIFIED", "NO"], ["PRIOR FLAGS", "2 — HEALTH MISINFORMATION"], ["BIO", "NONE — NO REAL NAME"]].map(([k, v]) => (
          <div key={k} className="flex gap-2 mb-2">
            <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(201,162,39,0.5)", letterSpacing: "0.12em", minWidth: "100px" }}>{k}</span>
            <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: (k === "VERIFIED" || k === "PRIOR FLAGS" || k === "BIO") ? "#e74c3c" : "#c9b882" }}>{v}</span>
          </div>
        ))}
        <div style={{ height: "1px", backgroundColor: "rgba(201,162,39,0.15)", margin: "10px 0" }} />
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#e74c3c", lineHeight: 1.7 }}>
          FLAG: Created 3 months ago. Growth inconsistent with organic reach. Previously flagged twice for health misinformation. No verifiable identity.
        </div>
      </div>
    ),
  },
  3: {
    type: "SOURCE VERIFICATION",
    title: "ORIGINAL SOURCE CHECK",
    marginNote: "no trail leads anywhere",
    mentorNote: "The link leads nowhere credible. When a source can't be traced, the claim collapses with it.",
    body: (
      <div>
        <div style={{ height: "1px", backgroundColor: "rgba(201,162,39,0.2)", marginBottom: "10px" }} />
        {[["SOURCE URL", "NATURACURENEWS.NET"], ["DOMAIN AGE", "42 DAYS OLD"], ["CONTACT INFO", "NONE — NO EDITOR LISTED"], ["ARCHIVE", "NOT INDEXED PRE-2024"], ["PRIMARY CLAIM", "\"ANCIENT REMEDY CURES ALL\""]].map(([k, v]) => (
          <div key={k} className="flex gap-2 mb-1.5">
            <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(201,162,39,0.5)", letterSpacing: "0.12em", minWidth: "90px" }}>{k}</span>
            <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: (k === "CONTACT INFO" || k === "DOMAIN AGE") ? "#e74c3c" : "#c9b882" }}>{v}</span>
          </div>
        ))}
        <div style={{ height: "1px", backgroundColor: "rgba(201,162,39,0.12)", margin: "10px 0" }} />
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#e74c3c", lineHeight: 1.7 }}>
          FLAG: No original research linked. Domain registered 42 days ago. No named editor or journalist. Story cannot be traced to any primary source.
        </div>
      </div>
    ),
  },
  4: {
    type: "RESEARCH AUDIT",
    title: "SCIENTIFIC EVIDENCE — NO STUDY FOUND",
    mentorNote: "No study. No paper. No trial. If the science existed, it would be published — and it isn't.",
    body: (
      <div>
        <div style={{ border: "1px solid rgba(201,162,39,0.2)", padding: "10px", marginBottom: "12px", backgroundColor: "rgba(7,9,15,0.8)" }}>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "rgba(201,162,39,0.5)", letterSpacing: "0.15em", marginBottom: "6px" }}>DATABASE SEARCH RESULTS</div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#e74c3c", letterSpacing: "0.08em", lineHeight: 1.6 }}>
            PUBMED: 0 RESULTS<br />
            WHO DATABASE: 0 RESULTS<br />
            COCHRANE LIBRARY: 0 RESULTS
          </div>
        </div>
        {[["PEER-REVIEWED", "NONE FOUND"], ["CLINICAL TRIAL", "NONE REGISTERED"], ["CITED STUDIES", "NONE — CLAIM UNSUPPORTED"], ["CONSENSUS", "NO SCIENTIFIC CONSENSUS"]].map(([k, v]) => (
          <div key={k} className="flex gap-2 mb-2">
            <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(201,162,39,0.5)", letterSpacing: "0.12em", minWidth: "110px" }}>{k}</span>
            <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#e74c3c" }}>{v}</span>
          </div>
        ))}
        <div style={{ height: "1px", backgroundColor: "rgba(201,162,39,0.15)", margin: "10px 0" }} />
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#e74c3c", lineHeight: 1.7 }}>
          FLAG: Zero peer-reviewed studies support this claim across three major medical databases. No clinical trial on record. The claim is scientifically unsupported.
        </div>
      </div>
    ),
  },
  5: {
    type: "EXPERT INTERVIEW TRANSCRIPT",
    title: "EXPERT OPINION — DR. K. OSEI",
    marginNote: "asked him twice — stood by it",
    mentorNote: "Dr. Osei is a credible anchor. Note his exact words: 'no credible study.' That's your counterweight.",
    body: (
      <div>
        <div style={{ height: "1px", backgroundColor: "rgba(201,162,39,0.2)", marginBottom: "10px" }} />
        {[["EXPERT", "DR. K. OSEI — EPIDEMIOLOGY"], ["INSTITUTION", "NATIONAL HEALTH INSTITUTE"], ["DATE", "CURRENT CASE · ORAL STATEMENT"]].map(([k, v]) => (
          <div key={k} className="flex gap-2 mb-1.5">
            <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(201,162,39,0.5)", letterSpacing: "0.12em", minWidth: "90px" }}>{k}</span>
            <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "17px", color: "#c9b882" }}>{v}</span>
          </div>
        ))}
        <div style={{ height: "1px", backgroundColor: "rgba(201,162,39,0.12)", margin: "10px 0" }} />
        <div style={{ fontFamily: "Caveat, cursive", fontSize: "17px", color: "#ffffff", lineHeight: 1.65 }}>
          "I reviewed the claim circulating online. There is no credible study — peer-reviewed or otherwise — supporting it. The plant mentioned does not demonstrate therapeutic value beyond placebo. I would urge anyone who saw this post not to act on it."
        </div>
      </div>
    ),
  },
  6: {
    type: "DIGITAL CREDIBILITY AUDIT",
    title: "WEBSITE CREDIBILITY — NATURACURENEWS.NET",
    mentorNote: "No About page. No contact. All caps. High ad density. Every marker of a junk-science site — check them all.",
    body: (
      <div>
        <div style={{ border: "1px solid rgba(201,162,39,0.2)", padding: "10px", marginBottom: "12px", backgroundColor: "rgba(201,162,39,0.04)" }}>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(201,162,39,0.5)", letterSpacing: "0.15em", marginBottom: "4px" }}>SITE AUDIT — NATURACURENEWS.NET</div>
          <div style={{ fontFamily: "Special Elite, serif", fontSize: "20px", color: "#ffd966" }}>HIGH AD DENSITY · ALL-CAPS HEADLINE · NO SOURCES</div>
        </div>
        {[["ABOUT PAGE", "MISSING"], ["CONTACT INFO", "NONE"], ["AD DENSITY", "VERY HIGH — 8 ADS ABOVE FOLD"], ["HEADLINE FORMAT", "ALL-CAPS — EMOTIONAL"], ["BYLINE", "\"NATURAL NEWS DESK\" — ANON"], ["DOMAIN AGE", "42 DAYS"]].map(([k, v]) => (
          <div key={k} className="flex gap-2 mb-2">
            <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(201,162,39,0.5)", letterSpacing: "0.12em", minWidth: "110px" }}>{k}</span>
            <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: (k === "ABOUT PAGE" || k === "CONTACT INFO" || k === "BYLINE") ? "#e74c3c" : "#c9b882" }}>{v}</span>
          </div>
        ))}
        <div style={{ height: "1px", backgroundColor: "rgba(201,162,39,0.15)", margin: "10px 0" }} />
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#e74c3c", lineHeight: 1.7 }}>
          FLAG: Website displays 8 of 10 low-credibility markers. No editorial contact. No sourced references. All-caps headline is a known clickbait pattern.
        </div>
      </div>
    ),
  },
};

// ─── Commander Mira character ─────────────────────────────────────────────────
const MIRA_MISSION_INTRO = "This post spread to 38,000 people in six hours. The source is anonymous. The medical claim is unsupported. I need you to evaluate it: should it be trusted, verified further, rejected as false, or reported as harmful? Take your time with the evidence.";

const MIRA_DEBRIEFS: Record<NonNullable<Verdict>, string> = {
  TRUST: "Confidence is useful — but trust without verification is a vulnerability. Review your Source Verification score. In this case, the anonymous origin and absent scientific study both argued for caution before trust.",
  VERIFY: "Smart call. Flagging content for verification is the most defensible choice when the evidence trail leads to dead ends. You protected yourself and others from acting on an unconfirmed claim.",
  REJECT: "Your evidence assessment is sound. No peer-reviewed study, an anonymous 94-day-old account, a website with no editorial standards — each one a named reason. Rejection, when supported by evidence, is a reasoned decision.",
  REPORT: "The right move. Health misinformation causes real harm. Every report triggers a platform review and slows the spread. You did not just assess the content — you acted on it.",
};

function MiraPortrait({ size = 50 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      border: "1px solid rgba(201,162,39,0.55)",
      backgroundColor: "#08090f",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Shoulder base */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "38%", background: "linear-gradient(to top, rgba(201,162,39,0.12), transparent)", borderTop: "1px solid rgba(201,162,39,0.2)" }} />
      {/* Neck */}
      <div style={{ position: "absolute", bottom: "34%", left: "50%", transform: "translateX(-50%)", width: "18%", height: "10%", backgroundColor: "rgba(201,162,39,0.08)" }} />
      {/* Head silhouette */}
      <div style={{ position: "absolute", top: "14%", left: "50%", transform: "translateX(-50%)", width: "42%", height: "44%", border: "1px solid rgba(201,162,39,0.4)", backgroundColor: "rgba(201,162,39,0.06)" }} />
      {/* Corner brackets */}
      <div style={{ position: "absolute", top: 3, left: 3, width: 6, height: 6, borderTop: "1px solid rgba(201,162,39,0.7)", borderLeft: "1px solid rgba(201,162,39,0.7)" }} />
      <div style={{ position: "absolute", top: 3, right: 3, width: 6, height: 6, borderTop: "1px solid rgba(201,162,39,0.7)", borderRight: "1px solid rgba(201,162,39,0.7)" }} />
      <div style={{ position: "absolute", bottom: 3, left: 3, width: 6, height: 6, borderBottom: "1px solid rgba(201,162,39,0.7)", borderLeft: "1px solid rgba(201,162,39,0.7)" }} />
      <div style={{ position: "absolute", bottom: 3, right: 3, width: 6, height: 6, borderBottom: "1px solid rgba(201,162,39,0.7)", borderRight: "1px solid rgba(201,162,39,0.7)" }} />
      {/* Label */}
      <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center", fontFamily: "Courier Prime, monospace", fontSize: "5px", color: "rgba(201,162,39,0.55)", letterSpacing: "0.18em" }}>MIRA</div>
    </div>
  );
}

function MiraPopup({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}
      style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}
    >
      {/* Speech bubble */}
      <div style={{ flex: 1, backgroundColor: "#07090f", border: "1px solid rgba(201,162,39,0.3)", padding: "10px 14px", position: "relative" }}>
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "6.5px", color: "#00e9ff", letterSpacing: "0.22em", marginBottom: "5px", opacity: 0.8 }}>COMMANDER MIRA</div>
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "8.5px", color: "rgba(0,233,255,0.72)", lineHeight: 1.75 }}>{message}</div>
        {/* Tail pointing right toward portrait */}
        <div style={{ position: "absolute", right: -6, top: "50%", transform: "translateY(-50%) rotate(45deg)", width: 10, height: 10, backgroundColor: "#07090f", borderRight: "1px solid rgba(201,162,39,0.3)", borderTop: "1px solid rgba(201,162,39,0.3)" }} />
      </div>
      <MiraPortrait size={50} />
    </motion.div>
  );
}

function EvidenceExhibitModal({ evidenceId, onClose }: { evidenceId: number; onClose: () => void }) {
  const e = EVIDENCE_DATA.find(ev => ev.id === evidenceId)!;
  const exhibit = EVIDENCE_EXHIBITS[evidenceId];
  if (!exhibit) return null;

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 300, backgroundColor: "rgba(0,0,0,0.88)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        style={{ width: "min(480px, 94vw)", backgroundColor: "#07090f", border: "1px solid rgba(201,162,39,0.35)", boxShadow: "0 24px 80px rgba(0,0,0,0.9)" }}
      >
        {/* Header strip */}
        <div style={{ borderBottom: "1px solid rgba(201,162,39,0.2)", padding: "10px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(201,162,39,0.05)" }}>
          <div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", letterSpacing: "0.25em", color: "rgba(201,162,39,0.5)", marginBottom: "2px" }}>{exhibit.type}</div>
            <div style={{ fontFamily: "Special Elite, serif", fontSize: "20px", color: "#ffd966", letterSpacing: "0.06em" }}>{exhibit.title}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ border: "1px solid rgba(201,162,39,0.35)", padding: "2px 7px" }}>
              <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", letterSpacing: "0.15em", color: e.auth > 70 ? "#22c55e" : e.auth > 50 ? "#c9a227" : "#e74c3c" }}>
                AUTH {e.auth}%
              </span>
            </div>
            <button onClick={onClose} style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "rgba(201,162,39,0.45)", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px", position: "relative" }}>
          {exhibit.body}
          {/* Caveat margin note */}
          {exhibit.marginNote && (
            <div style={{ position: "absolute", right: "-2px", top: "50%", transform: "translateY(-50%) rotate(2deg)", fontFamily: "Caveat, cursive", fontSize: "14px", color: "#c9a227", opacity: 0.7, textAlign: "right", maxWidth: "90px", lineHeight: 1.4, pointerEvents: "none" }}>
              {exhibit.marginNote}
            </div>
          )}
        </div>

        {/* Commander Mira commentary */}
        {exhibit.mentorNote && (
          <div style={{ borderTop: "1px solid rgba(201,162,39,0.12)", padding: "12px 18px", backgroundColor: "rgba(7,9,15,0.5)" }}>
            <MiraPopup message={exhibit.mentorNote} />
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(201,162,39,0.12)", padding: "8px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "rgba(201,162,39,0.35)", letterSpacing: "0.12em" }}>
            CASE 2024-1147 · EXHIBIT {evidenceId} · {e.tag}
          </span>
          <button onClick={onClose} style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", letterSpacing: "0.14em", color: "#c9a227", border: "1px solid rgba(201,162,39,0.3)", background: "none", padding: "5px 14px", cursor: "pointer" }}
            onMouseEnter={(ev) => (ev.currentTarget as HTMLElement).style.backgroundColor = "rgba(201,162,39,0.08)"}
            onMouseLeave={(ev) => (ev.currentTarget as HTMLElement).style.backgroundColor = "transparent"}
          >CLOSE FILE</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Left panel ───────────────────────────────────────────────────────────────
function LeftPanel({ investigated }: { investigated: string[] }) {
  const importanceColor = { HIGH: "#e74c3c", MED: "#c9a227", LOW: "#6b5f42" };

  return (
    <div className="flex flex-col h-full" style={{ borderRight: "1px solid rgba(201,162,39,0.2)" }}>
      {/* Header */}
      <div style={{ padding: "9px 12px 8px", borderBottom: "1px solid rgba(201,162,39,0.14)", flexShrink: 0 }}>
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "8px", color: "rgba(201,162,39,0.45)", letterSpacing: "0.22em", marginBottom: "1px" }}>CASE FILE</div>
        <div style={{ fontFamily: "Special Elite, serif", fontSize: "12px", color: "#ffd966", letterSpacing: "0.1em" }}>OBSERVATIONS</div>
      </div>

      {/* Log */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "8px", scrollbarWidth: "thin" }}>
        {investigated.length === 0 ? (
          <div style={{ padding: "16px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "8px", color: "rgba(201,162,39,0.28)", letterSpacing: "0.12em", lineHeight: 1.9 }}>
              SELECT AN ELEMENT<br />IN THE POST TO BEGIN<br />INVESTIGATION
            </div>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: "5px" }}>
            {investigated.map((id) => {
              const el = POST_ELEMENTS.find(e => e.id === id);
              const meta = POST_ELEMENT_META[id];
              if (!el || !meta) return null;
              return (
                <div key={id} style={{ border: "1px solid rgba(201,162,39,0.14)", padding: "7px 8px", backgroundColor: "rgba(201,162,39,0.03)" }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: "3px" }}>
                    <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "7.5px", color: "rgba(201,162,39,0.45)", letterSpacing: "0.14em" }}>{meta.tag}</span>
                    <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "7px", color: importanceColor[meta.importance], letterSpacing: "0.06em" }}>{meta.importance}</span>
                  </div>
                  <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "8.5px", color: "#c9b882", lineHeight: 1.5, wordBreak: "break-word" }}>
                    {el.content.length > 42 ? el.content.slice(0, 42) + "…" : el.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ padding: "8px 12px 10px", borderTop: "1px solid rgba(201,162,39,0.14)", flexShrink: 0 }}>
        <div className="flex justify-between" style={{ marginBottom: "5px" }}>
          <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "7.5px", color: "rgba(201,162,39,0.4)", letterSpacing: "0.14em" }}>ELEMENTS CHECKED</span>
          <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "7.5px", color: "#c9a227" }}>{investigated.length}/{POST_ELEMENTS.length}</span>
        </div>
        <div style={{ height: "3px", backgroundColor: "rgba(201,162,39,0.12)" }}>
          <div style={{ height: "100%", width: `${(investigated.length / POST_ELEMENTS.length) * 100}%`, backgroundColor: "#c9a227", transition: "width 0.4s ease" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Center panel ─────────────────────────────────────────────────────────────
// ─── Post elements for Case 2024-1147 ────────────────────────────────────────
const POST_ELEMENTS: { id: string; content: string; directions: string[] }[] = [
  { id: "headline",        content: "DIABETES GONE IN 7 DAYS!", directions: ["Find the original source of this claim", "Look for supporting medical research", "Check independent fact-checker coverage", "Investigate the emotional wording", "Record an observation and continue"] },
  { id: "claim-medicines", content: "No Medicines",             directions: ["Search for clinical evidence behind this", "Look for health authority statements", "Check whether any trial supports this claim", "Investigate what the phrase leaves out", "Record an observation and continue"] },
  { id: "claim-effects",   content: "No Side Effects",          directions: ["Find pharmacology sources on this substance", "Look for opposing medical literature", "Check whether this claim has been studied", "Investigate the safety implication", "Record an observation and continue"] },
  { id: "claim-everyone",  content: "Works for Everyone",       directions: ["Evaluate the scope of this generalisation", "Look for patient group exclusions", "Check what a broad medical claim requires", "Investigate what is being omitted", "Record an observation and continue"] },
  { id: "claim-thousands", content: "Helped thousands of people", directions: ["Find any verifiable data behind this figure", "Look for original source of these testimonials", "Check independent verification of the numbers", "Investigate the lack of specificity", "Record an observation and continue"] },
  { id: "cta",             content: "Share with your loved ones!", directions: ["Examine why urgency to share is included", "Look for this pattern in known misinformation", "Check whether credible sources use this tactic", "Investigate the emotional framing of the appeal", "Record an observation and continue"] },
  { id: "handle",          content: "naturalheals.in",          directions: ["Find when this account or domain was created", "Look for previous posts from this source", "Check site-credibility tools for this domain", "Investigate editorial standards listed on the site", "Record an observation and continue"] },
  { id: "engagement",      content: "124,532 likes",            directions: ["Find the spread timeline for this post", "Look into how engagement metrics can be inflated", "Check whether popularity implies accuracy", "Investigate the share-to-like ratio", "Record an observation and continue"] },
  { id: "comment",         content: "My uncle tried this and his sugar levels are normal now.", directions: ["Find the commenter's account history", "Look for similar anecdotal comment patterns", "Check whether personal testimony equals clinical proof", "Investigate whether this comment can be verified", "Record an observation and continue"] },
];

const POST_ELEMENT_META: Record<string, { tag: string; importance: "HIGH" | "MED" | "LOW" }> = {
  "headline":        { tag: "HEADLINE CLAIM", importance: "HIGH" },
  "handle":          { tag: "SOURCE ACCOUNT", importance: "HIGH" },
  "claim-medicines": { tag: "BODY CLAIM",     importance: "HIGH" },
  "claim-effects":   { tag: "BODY CLAIM",     importance: "HIGH" },
  "claim-everyone":  { tag: "BODY CLAIM",     importance: "MED"  },
  "claim-thousands": { tag: "BODY CLAIM",     importance: "MED"  },
  "cta":             { tag: "CALL TO ACTION", importance: "MED"  },
  "engagement":      { tag: "ENGAGEMENT",     importance: "LOW"  },
  "comment":         { tag: "USER COMMENT",   importance: "LOW"  },
};

function CenterPanel({ activeTool, selectedElement, investigated, onSelectElement, onMarkInvestigated }: {
  activeTool: Tool;
  selectedElement: string | null;
  investigated: Set<string>;
  onSelectElement: (id: string | null) => void;
  onMarkInvestigated: (id: string) => void;
}) {
  const [mouse, setMouse] = useState({ x: 50, y: 40 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setMouse({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  };

  const toolColor = activeTool ? TOOLS_DATA.find((t) => t.id === activeTool)?.color : undefined;
  const selectedPost = POST_ELEMENTS.find(e => e.id === selectedElement) ?? null;

  // Inline span renderer — regular function, not a React component, avoids remount churn
  const pspan = (el: typeof POST_ELEMENTS[0]) => {
    const isSel = selectedElement === el.id;
    const isDone = investigated.has(el.id);
    return (
      <span
        key={el.id}
        onClick={(e) => { e.stopPropagation(); onSelectElement(isSel ? null : el.id); }}
        onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.textShadow = "0 0 9px rgba(201,162,39,0.6)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textShadow = "none"; }}
        style={{
          cursor: "pointer",
          padding: "0 3px",
          backgroundColor: isSel ? "rgba(201,162,39,0.16)" : isDone ? "rgba(201,162,39,0.06)" : "transparent",
          border: isSel ? "1px solid rgba(201,162,39,0.45)" : "1px solid transparent",
          color: isSel ? "#ffd966" : isDone ? "#c9a227" : "inherit",
          transition: "background-color 0.1s, color 0.1s",
          display: "inline",
        }}
      >
        {el.content}{isDone ? <span style={{ fontSize: "7px", color: "#c9a227", verticalAlign: "super", marginLeft: "2px" }}>✓</span> : null}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header — unchanged */}
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid rgba(201,162,39,0.2)", flexShrink: 0 }}>
        <div style={{ fontFamily: "Special Elite, serif", fontSize: "22px", color: "#ffd966", letterSpacing: "0.09em" }}>EXHIBIT — VIRAL HEALTH CLAIM</div>
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#c9b882", letterSpacing: "0.15em" }}>CASE 2024-1147 · SOCIAL MEDIA</div>
      </div>

      <div
        ref={ref}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: "crosshair" }}
        onMouseMove={handleMove}
        onClick={() => onSelectElement(null)}
      >
        {/* Dark base — replaces stock photo */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #06080e 0%, #090a18 50%, #06080e 100%)" }} />

        {/* Dark wash */}
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(5,8,18,0.35)" }} />

        {/* Lamp spotlight that follows mouse — unchanged */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 38% 32% at ${mouse.x}% ${mouse.y}%, rgba(220,180,80,0.11) 0%, transparent 70%)` }} />

        {/* Social post card */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ padding: "20px" }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "rgba(11,13,22,0.92)", border: "1px solid rgba(201,162,39,0.1)", padding: "18px 20px", maxWidth: "360px", width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.65), 0 0 0 1px rgba(201,162,39,0.05)" }}
          >
            {/* Platform header */}
            <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "13px", paddingBottom: "10px", borderBottom: "1px solid rgba(201,162,39,0.08)" }}>
              <div style={{ width: "26px", height: "26px", border: "1px solid rgba(201,162,39,0.3)", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(201,162,39,0.07)", flexShrink: 0 }}>
                <span style={{ fontFamily: "Special Elite, serif", fontSize: "11px", color: "#c9a227" }}>N</span>
              </div>
              <div>
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10.5px", color: "#d0c8a8", lineHeight: 1 }}>{pspan(POST_ELEMENTS[6])}</div>
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "7.5px", color: "rgba(201,162,39,0.28)", letterSpacing: "0.1em", marginTop: "2px" }}>Health & Wellness · Sponsored</div>
              </div>
            </div>

            {/* Headline */}
            <div style={{ fontFamily: "Special Elite, serif", fontSize: "17px", color: "#ece4cc", letterSpacing: "0.03em", lineHeight: 1.3, marginBottom: "12px" }}>
              {pspan(POST_ELEMENTS[0])}
            </div>

            {/* Body claims */}
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#c2baa0", lineHeight: 2, marginBottom: "12px" }}>
              {[POST_ELEMENTS[1], POST_ELEMENTS[2], POST_ELEMENTS[3], POST_ELEMENTS[4]].map(el => (
                <div key={el.id} style={{ display: "flex", alignItems: "baseline", gap: "7px" }}>
                  <span style={{ color: "rgba(201,162,39,0.35)", flexShrink: 0, fontSize: "8px" }}>◆</span>
                  {pspan(el)}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10.5px", color: "#cfc8a8", fontStyle: "italic", marginBottom: "13px" }}>
              {pspan(POST_ELEMENTS[5])}
            </div>

            {/* Divider + engagement + comment */}
            <div style={{ borderTop: "1px solid rgba(201,162,39,0.08)", paddingTop: "10px" }}>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "rgba(201,162,39,0.4)", letterSpacing: "0.04em", marginBottom: "8px" }}>
                ♥ {pspan(POST_ELEMENTS[7])}
              </div>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "rgba(196,188,165,0.6)", borderLeft: "2px solid rgba(201,162,39,0.16)", paddingLeft: "8px", lineHeight: 1.65 }}>
                <span style={{ color: "rgba(201,162,39,0.3)" }}>user_comment: </span>
                &ldquo;{pspan(POST_ELEMENTS[8])}&rdquo;
              </div>
            </div>
          </div>
        </div>

        {/* Tool overlays — unchanged */}
        {activeTool && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 pointer-events-none">
            {activeTool === "scanner" && (
              <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(${toolColor}12 1px, transparent 1px), linear-gradient(90deg, ${toolColor}12 1px, transparent 1px)`, backgroundSize: "44px 44px", border: `1px solid ${toolColor}30` }}>
                {[["8%","12%"],["45%","28%"],["72%","55%"],["28%","68%"]].map(([l,t], i) => (
                  <div key={i} className="absolute" style={{ left: l, top: t }}>
                    <div style={{ width: 18, height: 18, border: `1.5px solid ${toolColor}`, borderRadius: "50%", position: "relative" }}>
                      <div style={{ position: "absolute", inset: "-5px", border: `1px solid ${toolColor}40`, borderRadius: "50%" }} />
                      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 3, height: 3, borderRadius: "50%", backgroundColor: toolColor }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTool === "timeline" && (
              <div className="absolute inset-x-4 bottom-4" style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: toolColor! }}>
                <div style={{ borderTop: `1px solid ${toolColor}40`, paddingTop: "8px" }}>SPREAD WINDOW · PUBLISHED: 06:14 · 500 SHARES: 08:00 ←→ FIRST FLAG: 09:45</div>
              </div>
            )}
            {activeTool === "camera" && (
              <>
                {[[28,38],[55,22],[71,62]].map(([lx,ty], i) => (
                  <div key={i} className="absolute" style={{ left: `${lx}%`, top: `${ty}%`, transform: "translate(-50%,-50%)" }}>
                    <div style={{ width: 22, height: 22, border: `2px solid ${toolColor}`, borderRadius: "50%", position: "relative" }}>
                      <div style={{ position: "absolute", inset: "-7px", border: `1px solid ${toolColor}35`, borderRadius: "50%" }} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 4, height: 4, border: `1px solid ${toolColor}`, borderRadius: "50%" }} />
                      </div>
                    </div>
                    <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 4, fontFamily: "Courier Prime, monospace", fontSize: "9px", color: toolColor, whiteSpace: "nowrap" }}>SITE {String.fromCharCode(65 + i)}</div>
                  </div>
                ))}
              </>
            )}
            {activeTool === "emotion" && (
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 55% 55% at 42% 40%, ${toolColor}22 0%, transparent 65%)` }}>
                <div className="absolute top-4 right-4" style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: toolColor, border: `1px solid ${toolColor}40`, padding: "6px 10px", backgroundColor: `${toolColor}10` }}>
                  FEAR/URGENCY: HIGH<br />CLICKBAIT SCORE: HIGH
                </div>
              </div>
            )}
            {activeTool === "bias" && (
              <div className="absolute inset-0 pointer-events-none" style={{ border: `1px solid ${toolColor}28` }}>
                <div className="absolute top-4 left-1/2" style={{ transform: "translateX(-50%)", fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: toolColor, border: `1px solid ${toolColor}40`, padding: "6px 14px", backgroundColor: `${toolColor}08`, textAlign: "center", letterSpacing: "0.12em" }}>
                  FRAMING ANALYSIS ACTIVE<br /><span style={{ fontSize: "9px", opacity: 0.7 }}>SCANNING FOR LOADED LANGUAGE</span>
                </div>
                {[["12%","38%","FEAR"],["70%","22%","ANGER"],["48%","72%","URGENCY"]].map(([l,t,lbl], i) => (
                  <div key={i} className="absolute" style={{ left: l, top: t }}>
                    <div style={{ width: 16, height: 16, border: `1.5px solid ${toolColor}90`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: toolColor }} />
                    </div>
                    <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 3, fontFamily: "Courier Prime, monospace", fontSize: "10px", color: toolColor, whiteSpace: "nowrap" }}>{lbl}</div>
                  </div>
                ))}
              </div>
            )}
            {activeTool === "metadata" && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute bottom-4 left-4 right-4" style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: toolColor, border: `1px solid ${toolColor}35`, padding: "8px 12px", backgroundColor: `${toolColor}07`, letterSpacing: "0.1em", lineHeight: 1.9 }}>
                  POST META · PUBLISHED: 06:14:08 · ACCT AGE: 94d · PRIOR FLAGS: 2 · LOCATION: HIDDEN
                </div>
                {[["18%","20%"],["60%","45%"]].map(([l,t],i) => (
                  <div key={i} className="absolute" style={{ left:l, top:t, width:20, height:20, border:`1px solid ${toolColor}60`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ width:6, height:6, border:`1px solid ${toolColor}`, borderRadius:"50%" }} />
                  </div>
                ))}
              </div>
            )}
            {activeTool === "verify" && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-4 left-4" style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: toolColor, lineHeight: 2.2, letterSpacing: "0.06em" }}>
                  {[{ label: "SOURCE CITED", pass: false }, { label: "FACT-CHECKED", pass: false }, { label: "REVERSE IMG", pass: false }, { label: "AUTHORSHIP", pass: true }].map(row => (
                    <div key={row.label} className="flex items-center gap-2">
                      <span style={{ color: row.pass ? "#22c55e" : "#e74c3c", fontSize: "9px" }}>{row.pass ? "✓" : "✗"}</span>
                      <span style={{ opacity: 0.85 }}>{row.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Corner metadata — unchanged */}
        <div className="absolute top-3 left-3" style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#ffd966", letterSpacing: "0.12em" }}>
          [EXHIBIT-01 · @HLTHTRUTH22 · 06:14 · SOCIAL FEED]
        </div>
        <div className="absolute bottom-3 right-3" style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#a89968" }}>
          MAGNIFICATION ACTIVE · MOVE TO INSPECT
        </div>

        {/* Bottom fade — unchanged */}
        <div className="absolute inset-x-0 bottom-0 h-8 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(7,9,15,1) 0%, transparent 100%)" }} />
      </div>

      {/* Bottom bar — investigation directions when element selected, tool readout otherwise */}
      <AnimatePresence mode="wait">
        {selectedPost ? (
          <motion.div
            key="directions"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ borderTop: "1px solid rgba(201,162,39,0.35)", backgroundColor: "rgba(201,162,39,0.07)", overflow: "hidden", flexShrink: 0 }}
          >
            <div className="px-4 py-2">
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "7.5px", color: "rgba(201,162,39,0.45)", letterSpacing: "0.22em", marginBottom: "5px" }}>
                SELECTED: {selectedPost.content.toUpperCase().slice(0, 38)}{selectedPost.content.length > 38 ? "…" : ""}
              </div>
              <div className="flex flex-col" style={{ gap: "1px" }}>
                {selectedPost.directions.map((dir, i) => (
                  <button
                    key={i}
                    onClick={() => { onMarkInvestigated(selectedPost.id); onSelectElement(null); }}
                    style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#c9b882", letterSpacing: "0.07em", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "2px 0", display: "flex", alignItems: "center", gap: "7px" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#ffd966"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#c9b882"; }}
                  >
                    <span style={{ color: "rgba(201,162,39,0.32)", flexShrink: 0, fontSize: "8px" }}>{i + 1}.</span>
                    {dir}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : activeTool && toolColor ? (
          <motion.div
            key="toolreadout"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ borderTop: `1px solid ${toolColor}35`, backgroundColor: `${toolColor}07`, overflow: "hidden", flexShrink: 0 }}
          >
            <div className="px-4 py-2">
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: toolColor, letterSpacing: "0.12em" }}>
                {getToolResult(activeTool!, selectedElement)}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ─── Stamp bar ────────────────────────────────────────────────────────────────
const VERDICTS = [
  { id: "TRUST" as const, color: "#00ff6a" },
  { id: "VERIFY" as const, color: "#f59e0b" },
  { id: "REJECT" as const, color: "#ef4444" },
  { id: "REPORT" as const, color: "#00e9ff" },
];

function StampBar({ onStamp }: { onStamp: (v: Verdict) => void }) {
  return (
    <div className="flex" style={{ borderTop: "1px solid rgba(201,162,39,0.1)", backgroundColor: "rgba(4,5,12,0.92)", flexShrink: 0 }}>
      {VERDICTS.map((v, i) => (
        <button
          key={v.id}
          onClick={() => onStamp(v.id)}
          className="flex-1 py-3 group transition-all"
          style={{ borderRight: i < 3 ? "1px solid rgba(201,162,39,0.1)" : "none", cursor: "pointer" }}
        >
          <div style={{
            fontFamily: "Special Elite, serif",
            fontSize: "22px",
            letterSpacing: "0.2em",
            color: v.color,
            opacity: 1,
            transition: "opacity 0.2s, text-shadow 0.2s",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textShadow = `0 0 12px ${v.color}80`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textShadow = "none"; }}
          >
            {v.id}
          </div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#c9b882", letterSpacing: "0.2em", marginTop: "3px" }}>
            STAMP TO RECORD
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Investigation screen ─────────────────────────────────────────────────────
function InvestigationScreen({ onVerdictFinal, onDiscoverFinding }: {
  onVerdictFinal: (v: NonNullable<Verdict>, investigated: string[]) => void;
  onDiscoverFinding: (f: DiscoveredFinding) => void;
}) {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [investigated, setInvestigated] = useState<Set<string>>(new Set());
  const [stampVerdict, setStampVerdict] = useState<Verdict>(null);
  const [showStamp, setShowStamp] = useState(false);

  useEffect(() => {
    if (!activeTool || !selectedElement) return;
    const text = TOOL_FINDINGS[activeTool]?.[selectedElement];
    if (!text) return;
    onDiscoverFinding({ elementId: selectedElement, toolId: activeTool, text });
  }, [activeTool, selectedElement]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkInvestigated = useCallback((elementId: string) => {
    setInvestigated(prev => { const s = new Set(prev); s.add(elementId); return s; });
  }, []);

  const handleStamp = useCallback((v: Verdict) => {
    setStampVerdict(v);
    setShowStamp(true);
  }, []);

  const handleDone = useCallback(() => {
    setShowStamp(false);
    if (stampVerdict) onVerdictFinal(stampVerdict, Array.from(investigated));
  }, [stampVerdict, investigated, onVerdictFinal]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 overflow-hidden">
        <div style={{ width: "220px", flexShrink: 0 }}>
          <LeftPanel investigated={Array.from(investigated)} />
        </div>
        <div className="flex-1 overflow-hidden">
          <CenterPanel
            activeTool={activeTool}
            selectedElement={selectedElement}
            investigated={investigated}
            onSelectElement={setSelectedElement}
            onMarkInvestigated={handleMarkInvestigated}
          />
        </div>
        <div style={{ width: "200px", flexShrink: 0 }}>
          <GadgetBelt activeTool={activeTool} onSelect={setActiveTool} selectedElement={selectedElement} />
        </div>
      </div>
      <StampBar onStamp={handleStamp} />
      <AnimatePresence>
        {showStamp && <StampOverlay verdict={stampVerdict} onDone={handleDone} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Rain component ───────────────────────────────────────────────────────────
function Rain() {
  const drops = useMemo(() => Array.from({ length: 55 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    duration: 0.45 + Math.random() * 0.55,
    opacity: 0.15 + Math.random() * 0.35,
    height: 8 + Math.floor(Math.random() * 18),
  })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {drops.map((d) => (
        <div
          key={d.id}
          className="rain-drop"
          style={{
            left: `${d.left}%`,
            height: `${d.height}px`,
            background: `rgba(110,180,220,${d.opacity})`,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Headquarters screen ──────────────────────────────────────────────────────
const CORK_ITEMS = [
  { id: 1, label: "VIRAL POST — CAP", x: 6, y: 9, rot: -3 },
  { id: 2, label: "@HLTHTRUTH22", x: 22, y: 4, rot: 2 },
  { id: 3, label: "SOURCE CHECK", x: 40, y: 11, rot: -1 },
  { id: 4, label: "NO STUDY FOUND", x: 57, y: 6, rot: 4 },
  { id: 5, label: "WEBSITE AUDIT", x: 71, y: 13, rot: -2 },
  { id: 6, label: "EXPERT — OSEI", x: 16, y: 42, rot: 3 },
  { id: 7, label: "SHARE CHAIN", x: 44, y: 50, rot: -4 },
  { id: 8, label: "VITABOOST LINK", x: 67, y: 44, rot: 2 },
];

const CORK_STRINGS = [[1, 2], [2, 3], [3, 4], [4, 5], [1, 6], [2, 6], [3, 7], [4, 7], [5, 8], [6, 7], [7, 8]];

function HeadquartersScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const getCenter = (id: number) => {
    const item = CORK_ITEMS.find((i) => i.id === id);
    return item ? { x: item.x + 5, y: item.y + 3.5 } : { x: 0, y: 0 };
  };

  return (
    <div className="flex h-full">
      {/* Rain window left */}
      <div className="flex-shrink-0 relative overflow-hidden" style={{ width: "160px", borderRight: "1px solid rgba(201,162,39,0.1)", background: "linear-gradient(180deg,#030810 0%,#050d14 100%)" }}>
        <Rain />
        {/* Window frame */}
        <div className="absolute inset-4 pointer-events-none" style={{ border: "1px solid rgba(201,162,39,0.18)" }}>
          <div className="absolute inset-x-0" style={{ top: "50%", borderTop: "1px solid rgba(201,162,39,0.12)" }} />
          <div className="absolute inset-y-0" style={{ left: "50%", borderLeft: "1px solid rgba(201,162,39,0.12)" }} />
        </div>
        {/* Condensation blur on glass */}
        <div className="absolute inset-4 pointer-events-none" style={{ backdropFilter: "blur(0.5px)" }} />
        {/* NPC silhouette */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2" style={{ filter: "blur(1.5px)", opacity: 0.85 }}>
          <svg width="38" height="68" viewBox="0 0 38 68" fill="#04080e">
            <ellipse cx="19" cy="11" rx="9" ry="10" />
            <rect x="9" y="20" width="20" height="33" rx="3" />
            <rect x="2" y="23" width="8" height="26" rx="4" />
            <rect x="28" y="23" width="8" height="26" rx="4" />
            <rect x="9" y="52" width="7" height="16" rx="3" />
            <rect x="22" y="52" width="7" height="16" rx="3" />
          </svg>
        </div>
        <div className="absolute bottom-4 inset-x-0 text-center" style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#3a3428", letterSpacing: "0.1em" }}>
          CDR. MIRA
        </div>
      </div>

      {/* Corkboard center */}
      <div className="flex-1 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#191008 0%,#140e06 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle 1px at 18px 18px, rgba(201,162,39,0.06) 0, transparent 0)",
          backgroundSize: "18px 18px",
        }} />
        <div className="absolute top-3 left-4" style={{ fontFamily: "Special Elite, serif", fontSize: "22px", color: "#c9a227", letterSpacing: "0.07em" }}>
          BUREAU HQ — OPERATIONS BOARD
        </div>

        {/* SVG strings */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {CORK_STRINGS.map(([a, b], i) => {
            const pa = getCenter(a), pb = getCenter(b);
            return (
              <line key={i}
                x1={`${pa.x}%`} y1={`${pa.y}%`}
                x2={`${pb.x}%`} y2={`${pb.y}%`}
                stroke={i % 3 === 0 ? "rgba(192,18,18,0.7)" : "rgba(192,18,18,0.38)"}
                strokeWidth={i % 3 === 0 ? "1.4" : "0.9"}
              />
            );
          })}
        </svg>

        {/* Cards */}
        {CORK_ITEMS.map((item) => (
          <div key={item.id} className="absolute" style={{ left: `${item.x}%`, top: `${item.y + 10}%`, transform: `rotate(${item.rot}deg)`, zIndex: 2 }}>
            <div style={{
              backgroundColor: "#e2cfae",
              padding: "5px 9px",
              width: "88px",
              boxShadow: "2px 4px 14px rgba(0,0,0,0.65)",
              position: "relative",
            }}>
              <div style={{ position: "absolute", top: "-7px", left: "50%", transform: "translateX(-50%)", width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#c9a227", boxShadow: "0 0 5px #c9a22790" }} />
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#1a1005", letterSpacing: "0.07em", lineHeight: 1.5 }}>{item.label}</div>
            </div>
          </div>
        ))}

        {/* Navigation / Room doors */}
        <div className="absolute bottom-4 left-0 right-0 flex flex-wrap justify-center gap-3 px-6">
          {[
            { id: "case-select", label: "MISSION BOARD", icon: "◎", locked: false, badge: true },
            { id: "notebook", label: "NOTEBOOK", icon: "⊞", locked: false },
            { id: "handbook", label: "HANDBOOK", icon: "◈", locked: false },
            { id: "evidence-wall", label: "EVIDENCE WALL", icon: "◉", locked: false },
            { id: "profile", label: "PROFILE", icon: "▲", locked: false },
            { id: "settings", label: "SETTINGS", icon: "▼", locked: false },
            { id: "archive", label: "ARCHIVE", icon: "■", locked: true },
            { id: "comms", label: "COMMS", icon: "◆", locked: true },
          ].map((tab, i) => (
            <div key={i} className="transition-all relative" style={{
              border: "1px solid rgba(201,162,39,0.2)",
              padding: "7px 12px",
              backgroundColor: "rgba(7,9,15,0.75)",
              cursor: tab.locked ? "not-allowed" : "pointer",
              opacity: tab.locked ? 0.4 : 1,
            }}
              onClick={() => !tab.locked && onNavigate(tab.id as Screen)}
              onMouseEnter={(e) => { if (!tab.locked) { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,162,39,0.55)"; (e.currentTarget as HTMLElement).style.textShadow = "0 0 12px rgba(201,162,39,0.7)"; } }}
              onMouseLeave={(e) => { if (!tab.locked) { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,162,39,0.2)"; (e.currentTarget as HTMLElement).style.textShadow = "none"; } }}
            >
              {tab.badge && (
                <div className="absolute dot-pulse" style={{ top: "-3px", right: "-3px", width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#e74c3c" }} />
              )}
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#6b5f42", letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#c9a227", fontSize: "9px" }}>{tab.icon}</span> {tab.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status right panel */}
      <div className="flex-shrink-0 flex flex-col" style={{ width: "130px", borderLeft: "1px solid rgba(201,162,39,0.1)", backgroundColor: "#060810" }}>
        <div className="px-3 py-2" style={{ borderBottom: "1px solid rgba(201,162,39,0.1)" }}>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#6b5f42", letterSpacing: "0.15em" }}>CASE STATUS</div>
        </div>
        <div className="flex-1 p-3 flex flex-col gap-4">
          <div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#3a3428", letterSpacing: "0.12em", marginBottom: "2px" }}>RANK</div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#c9b882", letterSpacing: "0.08em" }}>DETECTIVE II</div>
          </div>
          <div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#3a3428", letterSpacing: "0.12em", marginBottom: "2px" }}>XP / COINS</div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#c9b882", letterSpacing: "0.08em" }}>4,250 / 850</div>
          </div>
          <div style={{ height: "1px", backgroundColor: "rgba(201,162,39,0.08)" }} />
          {[
            { label: "LEADS OPEN", value: "07", color: "#c9a227" },
            { label: "SUSPECTS", value: "03", color: "#e74c3c" },
            { label: "EVIDENCE", value: "12", color: "#00bfff" },
            { label: "DAYS ACTIVE", value: "04", color: "#6b5f42" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#3a3428", letterSpacing: "0.12em" }}>{s.label}</div>
              <div style={{ fontFamily: "Special Elite, serif", fontSize: "26px", color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="p-3" style={{ borderTop: "1px solid rgba(201,162,39,0.08)" }}>
          <div className="amber-glow" style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#c9a227", letterSpacing: "0.1em" }}>● ACTIVE</div>
        </div>
      </div>
    </div>
  );
}

// ─── Notebook screen ──────────────────────────────────────────────────────────
const NOTE_ENTRIES = [
  {
    short: "Author unknown — no name, no credentials.",
    flag: "CRITICAL",
    detail: "Anonymous authorship is a key red flag. Any credible medical claim will cite the name, institution, and credentials of the person making it. This post listed none — it cannot be attributed or verified.",
  },
  {
    short: "No peer-reviewed study found in any database.",
    flag: "RESEARCH",
    detail: "PubMed, WHO, and the Cochrane Library returned zero results for this claim. Peer review is the minimum standard for medical evidence. An absence of any study means no scientific foundation exists.",
  },
  {
    short: "Headline designed to trigger fear and sharing.",
    flag: "MANIPULATION",
    detail: "All-caps text, urgent emoji, and 'SHARE before they delete this' are deliberate emotional triggers engineered to bypass critical thinking and encourage rapid sharing before anyone pauses to verify.",
  },
  {
    short: "Website: no About page, no contact info.",
    flag: "DIGITAL",
    detail: "A credible news or research outlet always lists its editorial team, a contact address, and an About page. naturacurenews.net has none — it cannot be held accountable for what it publishes.",
  },
  {
    short: "Medical claim is entirely unsupported.",
    flag: "EXPERT",
    detail: "Dr. K. Osei (National Health Institute) stated: 'There is no credible study — peer-reviewed or otherwise — supporting this claim.' The substance does not demonstrate therapeutic value beyond placebo.",
  },
  {
    short: "Post actively encourages mass sharing.",
    flag: "PATTERN",
    detail: "The call to 'SHARE before they delete this' is a manipulation tactic designed to create urgency and prevent the reader from fact-checking. Legitimate health information does not need to be spread this way.",
  },
];

// ─── Notebook per-case data ───────────────────────────────────────────────────
const NOTEBOOK_CASES: Record<string, {
  photos: { label: string; url: string; rot: number; align: "flex-start" | "flex-end" }[];
  evidenceItems: string[];
}> = {
  "2024-1147": {
    photos: [
      { label: "VIRAL POST — SCREENGRAB", url: "https://images.unsplash.com/photo-1724862936518-ae7fcfc052c1?w=220&h=150&fit=crop&auto=format", rot: -2, align: "flex-start" },
      { label: "NATURACURENEWS.NET AUDIT", url: "https://images.unsplash.com/photo-1579869847557-1f67382cc158?w=220&h=150&fit=crop&auto=format", rot: 3, align: "flex-end" },
      { label: "DR. OSEI — EXPERT STMT.", url: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=220&h=150&fit=crop&auto=format", rot: -1, align: "flex-start" },
    ],
    evidenceItems: [
      "Author unknown — no credentials listed",
      "No peer-reviewed study found in 3 databases",
      "Headline uses fear language + urgent emoji",
      "Source website 42 days old, no About page",
      "Account only 94 days old, 2 prior flags",
      "Post actively encourages mass sharing",
    ],
  },
};

const VERDICT_PAST: Record<NonNullable<Verdict>, string> = {
  TRUST: "TRUSTED", VERIFY: "VERIFIED", REJECT: "REJECTED", REPORT: "REPORTED",
};

function NotebookScreen({ cases, onUpdateNotes, onBack }: {
  cases: CaseRecord[];
  onUpdateNotes: (caseId: string, notes: string) => void;
  onBack: () => void;
}) {
  const [currentPage, setCurrentPage] = useState<"index" | string>("index");
  const [prevPage, setPrevPage] = useState<"index" | string | null>(null);
  const [pageDir, setPageDir] = useState<"forward" | "back">("forward");
  const [shadowKey, setShadowKey] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipKey, setFlipKey] = useState(0);

  const solvedCases = useMemo(() => cases.filter(c => c.status === "closed-solved"), [cases]);
  const solvedIds = useMemo(() => solvedCases.map(c => c.caseId), [solvedCases]);

  const navigate = useCallback((target: "index" | string, dir: "forward" | "back") => {
    setPrevPage(currentPage);
    setPageDir(dir);
    setCurrentPage(target);
    setShadowKey(k => k + 1);
    setFlipKey(k => k + 1);
    setIsFlipping(true);
  }, [currentPage]);

  const goBack = useCallback(() => {
    const idx = solvedIds.indexOf(currentPage as string);
    if (idx <= 0) navigate("index", "back");
    else navigate(solvedIds[idx - 1], "back");
  }, [currentPage, solvedIds, navigate]);

  const goForward = useCallback(() => {
    if (currentPage === "index") {
      if (solvedIds.length > 0) navigate(solvedIds[0], "forward");
    } else {
      const idx = solvedIds.indexOf(currentPage as string);
      if (idx < solvedIds.length - 1) navigate(solvedIds[idx + 1], "forward");
    }
  }, [currentPage, solvedIds, navigate]);

  const canGoBack = currentPage !== "index";
  const canGoForward = currentPage === "index"
    ? solvedIds.length > 0
    : solvedIds.indexOf(currentPage as string) < solvedIds.length - 1;
  const currentIdx = solvedIds.indexOf(currentPage as string);

  const suspicionFor = (v: Verdict): number => {
    if (v === "REPORT") return 92; if (v === "REJECT") return 85;
    if (v === "VERIFY") return 58; return 26;
  };

  const ruledLines = { backgroundImage: "repeating-linear-gradient(transparent,transparent 27px,rgba(80,50,18,0.16) 27px,rgba(80,50,18,0.16) 28px)" };

  const TabMarkers = ({ active }: { active: "A" | "B" | "C" }) => (
    <div className="absolute right-0 top-14 flex flex-col gap-1.5" style={{ zIndex: 20 }}>
      {(["A", "B", "C"] as const).map(l => (
        <div key={l} style={{ backgroundColor: l === active ? "#c9a227" : "#5a3a1a", width: "20px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: l === active ? "#07090f" : "#c9b882" }}>{l}</span>
        </div>
      ))}
    </div>
  );

  // Render helpers — each returns one page div (flex-1) for either the static backdrop or the turning overlay.
  const renderLeft = (pg: "index" | string): React.ReactNode => {
    if (pg === "index") {
      return (
        <div className="flex-1 relative overflow-hidden p-5" style={{ background: "linear-gradient(135deg,#c8976c 0%,#d4a87a 25%,#dfbf90 55%,#d4a87a 80%,#c0906a 100%)", borderRight: "2px solid #5a3a1a" }}>
          <div className="absolute inset-0 pointer-events-none" style={ruledLines} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 52%, rgba(55,25,5,0.3) 100%)" }} />
          <div className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: "30px", background: "linear-gradient(to right, rgba(55,25,5,0.25) 0%, transparent 100%)" }} />
          <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "36px", background: "linear-gradient(to top, rgba(55,25,5,0.2) 0%, transparent 100%)" }} />
          <div className="absolute pointer-events-none" style={{ right: "8%", bottom: "12%", width: "72px", height: "72px", borderRadius: "50%", border: "3px solid rgba(80,50,18,0.28)", boxShadow: "inset 0 0 16px rgba(80,50,18,0.08)", transform: "rotate(-10deg) scaleX(1.35)" }} />
          <div className="absolute pointer-events-none" style={{ left: "11%", bottom: "19%", transform: "rotate(-6deg)", zIndex: 5 }}>
            <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "radial-gradient(circle at 38% 36%, #8a3a18, #521e08)", boxShadow: "0 2px 8px rgba(0,0,0,0.55), inset 0 1px 3px rgba(255,140,60,0.18)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(201,162,39,0.28)" }}>
              <span style={{ fontFamily: "Special Elite, serif", fontSize: "18px", color: "rgba(201,162,39,0.65)" }}>⊛</span>
            </div>
          </div>
          <div className="absolute top-0 left-0 pointer-events-none" style={{ width: 0, height: 0, borderStyle: "solid", borderWidth: "30px 30px 0 0", borderColor: "#a07238 transparent transparent transparent", opacity: 0.32 }} />
          <div className="relative z-10 flex flex-col items-center justify-center h-full gap-5" style={{ opacity: 0.55 }}>
            <div style={{ fontFamily: "Special Elite, serif", fontSize: "38px", color: "#5a3a1a", textAlign: "center", letterSpacing: "0.06em", lineHeight: 1.25 }}>CASE<br />JOURNAL</div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "8.5px", color: "#5a3a1a", letterSpacing: "0.28em", textAlign: "center" }}>PRECINCT 14<br />FIELD DIVISION</div>
            <div style={{ width: "52px", height: "52px", border: "2px solid rgba(90,58,26,0.4)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Special Elite, serif", fontSize: "20px", color: "#5a3a1a" }}>◎</div>
          </div>
        </div>
      );
    }
    const cr = solvedCases.find(c => c.caseId === pg);
    const meta = CASES_CATALOG.find(m => m.caseId === pg);
    const nbData = NOTEBOOK_CASES[pg as string];
    if (!cr) return null;
    const photos = nbData?.photos ?? [];
    const pgIdx = solvedIds.indexOf(pg as string);
    return (
      <div className="flex-1 relative overflow-hidden p-5" style={{ background: "linear-gradient(to right,#c8a478 0%,#d4b086 30%,#dfc090 55%,#d4b086 80%,#c2966e 100%)", borderRight: "2px solid #5a3a1a" }}>
        <div className="absolute inset-0 pointer-events-none" style={ruledLines} />
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle 0.4px at 1px 1px, rgba(80,50,18,0.18) 0, transparent 0)", backgroundSize: "3px 3px", opacity: 0.6 }} />
        <div className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: "32px", background: "linear-gradient(to right, rgba(45,18,3,0.28) 0%, rgba(45,18,3,0.08) 60%, transparent 100%)" }} />
        <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: "28px", background: "linear-gradient(to bottom, rgba(45,18,3,0.22) 0%, transparent 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "36px", background: "linear-gradient(to top, rgba(45,18,3,0.25) 0%, transparent 100%)" }} />
        <div className="absolute pointer-events-none" style={{ right: "8%", bottom: "12%", width: "72px", height: "72px", borderRadius: "50%", border: "3px solid rgba(80,50,18,0.28)", boxShadow: "inset 0 0 16px rgba(80,50,18,0.08)", transform: "rotate(-10deg) scaleX(1.35)" }} />
        <div className="relative z-10 h-full flex flex-col">
          <div style={{ fontFamily: "Special Elite, serif", fontSize: "14px", color: "#5a3a1a", letterSpacing: "0.1em", marginBottom: "12px", opacity: 0.65, flexShrink: 0 }}>EXHIBIT LOG — {(meta?.title ?? pg).toUpperCase()}</div>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, scrollbarWidth: "none" as const }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "8px" }}>
              {photos.map((photo, i) => (
                <div key={i} style={{ display: "flex", justifyContent: photo.align }}>
                  <div style={{ transform: `rotate(${photo.rot}deg)`, backgroundColor: "#f2ede2", padding: "5px 5px 22px", boxShadow: "3px 4px 14px rgba(0,0,0,0.45)" }}>
                    <img src={photo.url} alt={photo.label} style={{ width: "140px", height: "95px", objectFit: "cover", filter: "grayscale(0.45) contrast(1.1) brightness(0.95)", display: "block" }} />
                    <div style={{ fontFamily: "Caveat, cursive", fontSize: "12px", color: "#5a3a1a", marginTop: "4px", textAlign: "center" }}>{photo.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={goBack} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "5px", fontFamily: "Courier Prime, monospace", fontSize: "8.5px", color: "rgba(90,58,26,0.45)", letterSpacing: "0.15em", background: "none", border: "none", cursor: "pointer", marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed rgba(80,50,18,0.18)" }}>
            ◂◂ {pgIdx === 0 ? "INDEX" : "PREV CASE"}
          </button>
        </div>
      </div>
    );
  };

  const renderRight = (pg: "index" | string): React.ReactNode => {
    const pgIdx = solvedIds.indexOf(pg as string);
    const pgCanGoForward = pg === "index" ? solvedIds.length > 0 : pgIdx < solvedIds.length - 1;
    if (pg === "index") {
      return (
        <div className="flex-1 relative overflow-hidden p-6" style={{ background: "linear-gradient(160deg,#ecdab0 0%,#e8d4a0 55%,#e0ca88 100%)" }}>
          <div className="absolute inset-0 pointer-events-none" style={ruledLines} />
          <div className="absolute top-0 right-0 pointer-events-none" style={{ width: 0, height: 0, borderStyle: "solid", borderWidth: "0 42px 42px 0", borderColor: "transparent #b88e30 transparent transparent", opacity: 0.45 }} />
          <div className="absolute pointer-events-none" style={{ right: "14%", bottom: "20%", width: "52px", height: "46px", borderRadius: "52% 40% 58% 42%", border: "2px solid rgba(80,50,18,0.11)", transform: "rotate(18deg) scaleX(1.5)", opacity: 0.65 }} />
          <TabMarkers active="A" />
          <div className="relative z-10 h-full flex flex-col pr-6">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "Caveat, cursive", fontSize: "30px", color: "#3a2010", fontWeight: 700, marginBottom: "2px" }}>Case Index</div>
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "8.5px", color: "#5a3a1a", letterSpacing: "0.18em", opacity: 0.7 }}>SOLVED CASES — PRECINCT 14</div>
              </div>
              <div style={{ transform: "rotate(2.5deg)", border: "1.5px solid rgba(90,58,26,0.38)", padding: "4px 9px", backgroundColor: "rgba(90,58,26,0.05)", flexShrink: 0, marginTop: "3px" }}>
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "7px", color: "rgba(90,58,26,0.48)", letterSpacing: "0.15em" }}>CASES SOLVED</div>
                <div style={{ fontFamily: "Special Elite, serif", fontSize: "22px", color: "#5a3a1a", textAlign: "center", lineHeight: 1 }}>{solvedCases.length}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" as const, minHeight: 0 }}>
              {solvedCases.length === 0 ? (
                <div style={{ fontFamily: "Caveat, cursive", fontSize: "21px", color: "rgba(90,58,26,0.42)", marginTop: "48px", textAlign: "center", lineHeight: 1.7 }}>
                  No cases solved yet.<br /><span style={{ fontSize: "15px" }}>Complete your first case to see it here.</span>
                </div>
              ) : (
                <div className="flex flex-col">
                  {solvedCases.map((c, i) => {
                    const meta = CASES_CATALOG.find(m => m.caseId === c.caseId);
                    const sp = STAMP_PALETTE[c.finalVerdict ?? "VERIFY"];
                    return (
                      <div key={c.caseId}>
                        <button onClick={() => navigate(c.caseId, "forward")} style={{ display: "flex", alignItems: "center", gap: "10px", border: "none", background: "none", padding: "9px 0 9px 10px", cursor: "pointer", textAlign: "left", borderLeft: `3px solid ${sp.color}`, width: "100%" }}>
                          <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "rgba(90,58,26,0.5)", flexShrink: 0 }}>{i + 1}.</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "Special Elite, serif", fontSize: "12px", color: "#3a2010", letterSpacing: "0.07em" }}>{meta?.title ?? c.caseId}</div>
                            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "8px", color: "rgba(90,58,26,0.5)", letterSpacing: "0.12em", marginTop: "1px" }}>#{c.caseId} · {c.finalVerdict}</div>
                          </div>
                          <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "11px", color: "rgba(90,58,26,0.35)", flexShrink: 0, paddingRight: "4px" }}>▸</span>
                        </button>
                        <div style={{ borderBottom: "1px dashed rgba(80,50,18,0.2)", marginLeft: "10px" }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ flex: "0 0 auto", minHeight: "28px", position: "relative", pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: "12%", top: "30%", width: "44px", height: "38px", borderRadius: "48% 52% 55% 45%", border: "1.5px solid rgba(80,50,18,0.09)", transform: "rotate(-14deg) scaleX(1.4)", opacity: 0.7 }} />
              <div style={{ position: "absolute", right: "18%", top: "55%", width: "26px", height: "22px", borderRadius: "50%", border: "1px solid rgba(80,50,18,0.07)", transform: "rotate(8deg) scaleX(1.7)", opacity: 0.6 }} />
            </div>
            {pgCanGoForward && (
              <button onClick={goForward} style={{ marginTop: "6px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "5px", fontFamily: "Courier Prime, monospace", fontSize: "8.5px", color: "rgba(90,58,26,0.45)", letterSpacing: "0.15em", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>FIRST CASE ▸▸</button>
            )}
          </div>
        </div>
      );
    }
    const cr = solvedCases.find(c => c.caseId === pg);
    const meta = CASES_CATALOG.find(m => m.caseId === pg);
    const nbData = NOTEBOOK_CASES[pg as string];
    if (!cr) return null;
    const sp = STAMP_PALETTE[cr.finalVerdict ?? "VERIFY"];
    const baseEvidence = nbData?.evidenceItems ?? [];
    const extraEvidence = (cr.discoveredFindings ?? []).map(f => {
      const toolLabel = TOOLS_DATA.find(t => t.id === f.toolId)?.label ?? f.toolId.toUpperCase();
      return `[${toolLabel}] ${f.text}`;
    });
    const evidenceItems = [...baseEvidence, ...extraEvidence];
    const suspicion = suspicionFor(cr.finalVerdict);
    const meterColor = suspicion > 75 ? "#8a2810" : suspicion > 50 ? "#c9a227" : "#3a6828";
    return (
      <div className="flex-1 relative overflow-hidden p-6" style={{ background: "linear-gradient(to right,#e8d5a3 0%,#e0c896 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={ruledLines} />
        <div className="absolute top-0 right-0 pointer-events-none" style={{ width: 0, height: 0, borderStyle: "solid", borderWidth: "0 42px 42px 0", borderColor: "transparent #b88e30 transparent transparent", opacity: 0.45 }} />
        <TabMarkers active="B" />
        <div style={{ position: "absolute", right: "28px", bottom: "50px", fontFamily: "Caveat, cursive", fontSize: "14px", color: "#8a2810", border: "2px solid #8a2810", borderRadius: "50%", padding: "8px 6px", lineHeight: 1.5, transform: "rotate(8deg)", textAlign: "center", width: "78px", pointerEvents: "none" }}>check the<br />source first!</div>
        <div className="relative z-10 h-full flex flex-col pr-7">
          <div style={{ fontFamily: "Caveat, cursive", fontSize: "25px", color: "#3a2010", fontWeight: 700, marginBottom: "1px" }}>Case Notes — {meta?.title ?? pg}</div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "8px", color: "#5a3a1a", letterSpacing: "0.14em", marginBottom: "12px", opacity: 0.65 }}>#{cr.caseId} · PAGE {pgIdx + 1} OF {solvedIds.length}</div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-16" style={{ scrollbarWidth: "none" as const, minHeight: 0 }}>
            <div>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "7.5px", color: "rgba(90,58,26,0.55)", letterSpacing: "0.22em", marginBottom: "6px" }}>◈ EVIDENCE COLLECTED</div>
              <div className="flex flex-col gap-1">
                {evidenceItems.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                    <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "11px", color: "#3a6828", marginTop: "2px", flexShrink: 0 }}>✓</span>
                    <span style={{ fontFamily: "Caveat, cursive", fontSize: "15px", color: "#3a2010", lineHeight: 1.35 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "7.5px", color: "rgba(90,58,26,0.55)", letterSpacing: "0.22em", marginBottom: "6px" }}>◉ SUSPICION METER</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ flex: 1, height: "9px", backgroundColor: "rgba(90,58,26,0.14)", border: "1px solid rgba(90,58,26,0.22)" }}>
                  <div style={{ width: `${suspicion}%`, height: "100%", backgroundColor: meterColor }} />
                </div>
                <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#3a2010", flexShrink: 0 }}>{suspicion}%</span>
              </div>
              <div style={{ fontFamily: "Caveat, cursive", fontSize: "13px", color: "rgba(90,58,26,0.52)", marginTop: "3px" }}>{suspicion > 75 ? "High — strong red flags identified" : suspicion > 50 ? "Moderate — some concerns noted" : "Low — content appeared credible"}</div>
            </div>
            <div>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "7.5px", color: "rgba(90,58,26,0.55)", letterSpacing: "0.22em", marginBottom: "6px" }}>◐ DECISION</div>
              <div style={{ display: "inline-flex", alignItems: "center", border: `1.5px solid ${sp.color}`, backgroundColor: sp.bg, padding: "5px 14px" }}>
                <span style={{ fontFamily: "Special Elite, serif", fontSize: "14px", color: sp.color, letterSpacing: "0.16em" }}>{cr.finalVerdict}</span>
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "7.5px", color: "rgba(90,58,26,0.55)", letterSpacing: "0.22em", marginBottom: "6px" }}>◫ REASONING NOTES</div>
              <textarea value={cr.notebookNotes ?? ""} onChange={(e) => onUpdateNotes(cr.caseId, e.target.value)} placeholder="Write your reasoning here..." rows={4} style={{ width: "100%", resize: "none", fontFamily: "Caveat, cursive", fontSize: "16px", color: "#3a2010", backgroundColor: "rgba(255,255,255,0.18)", border: "1px solid rgba(90,58,26,0.3)", padding: "6px 8px", outline: "none", lineHeight: 1.5 }} />
            </div>
            <div>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "7.5px", color: "rgba(90,58,26,0.55)", letterSpacing: "0.22em", marginBottom: "6px" }}>◻ FINAL VERDICT</div>
              <div style={{ fontFamily: "Caveat, cursive", fontSize: "19px", color: "#3a2010", fontWeight: 700 }}>CASE CLOSED — {VERDICT_PAST[cr.finalVerdict ?? "VERIFY"]}</div>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "7.5px", color: "rgba(90,58,26,0.4)", letterSpacing: "0.14em", marginTop: "2px" }}>See full report in Investigation Records</div>
            </div>
          </div>
          {pgCanGoForward && (
            <button onClick={goForward} style={{ position: "absolute", bottom: "16px", right: "32px", display: "flex", alignItems: "center", gap: "5px", fontFamily: "Courier Prime, monospace", fontSize: "8.5px", color: "rgba(90,58,26,0.45)", letterSpacing: "0.15em", background: "none", border: "none", cursor: "pointer" }}>NEXT CASE ▸▸</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#07090f" }}>

      {/* ── Header (fix 4): gradient bg + glow underline + flanked icon ── */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, rgba(6,7,14,0.98) 0%, rgba(16,11,3,0.98) 100%)",
          borderBottom: "1px solid rgba(201,162,39,0.28)",
          boxShadow: "0 1px 0 rgba(201,162,39,0.16), 0 3px 16px rgba(201,162,39,0.06)",
          zIndex: 150,
        }}
      >
        <button
          onClick={onBack}
          style={{ fontFamily: "Special Elite, serif", fontSize: "22px", letterSpacing: "0.15em", color: "#c9a227", border: "1px solid rgba(201,162,39,0.4)", backgroundColor: "transparent", padding: "4px 12px", cursor: "pointer" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textShadow = "0 0 12px rgba(201,162,39,0.7)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textShadow = "none"; }}
        >← BUREAU</button>
        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <span style={{ fontFamily: "Special Elite, serif", fontSize: "14px", color: "rgba(201,162,39,0.3)", lineHeight: 1 }}>⊠</span>
          <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "11px", color: "#b8a878", letterSpacing: "0.28em" }}>NOTEBOOK</span>
          <span style={{ fontFamily: "Special Elite, serif", fontSize: "14px", color: "rgba(201,162,39,0.3)", lineHeight: 1 }}>⊠</span>
        </div>
        <div style={{ width: "128px" }} />
      </div>

      {/* ── Book area ── */}
      <div className="flex-1 flex items-center justify-center p-5" style={{ background: "radial-gradient(ellipse at center,#191008 0%,#07090f 100%)" }}>
        <div style={{ position: "relative", height: "88%", width: "100%", maxWidth: "960px" }}>

          {/* Ground shadow */}
          <div style={{ position: "absolute", bottom: "-30px", left: "6%", right: "6%", height: "55px", zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, transparent 65%)", filter: "blur(10px)" }} />

          {/* Right fore-edge page stack */}
          <div style={{ position: "absolute", right: "10px", top: "1.5%", bottom: "1.5%", width: "12px", zIndex: 1, pointerEvents: "none", background: "repeating-linear-gradient(to right, rgba(232,213,163,0.9) 0px, rgba(232,213,163,0.9) 1px, rgba(210,188,140,0.5) 1px, rgba(210,188,140,0.5) 2px, transparent 2px, transparent 3px)", transform: "translateX(12px)", boxShadow: "2px 0 6px rgba(0,0,0,0.4)" }} />

          {/* Bottom fore-edge page stack */}
          <div style={{ position: "absolute", bottom: "0px", left: "2%", right: "2%", height: "10px", zIndex: 1, pointerEvents: "none", background: "repeating-linear-gradient(to bottom, rgba(232,213,163,0.8) 0px, rgba(232,213,163,0.8) 1px, rgba(210,188,140,0.45) 1px, rgba(210,188,140,0.45) 2px, transparent 2px, transparent 3px)", transform: "translateY(10px)", boxShadow: "0 3px 8px rgba(0,0,0,0.5)" }} />

          {/* Book — flat (no rotateX tilt), depth from shadow only */}
          <div className="flex" style={{ height: "100%", boxShadow: "0 28px 80px rgba(0,0,0,0.9), 0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,162,39,0.18)", position: "relative", zIndex: 2 }}>

            {/* Leather spine — deepened crease shadow so center reads as a real binding */}
            <div style={{ width: "18px", flexShrink: 0, position: "relative", background: "linear-gradient(to right, #1a0d03, #2a1608 45%, #3d2212 65%, #2a1608)", boxShadow: "inset -7px 0 16px rgba(0,0,0,0.85), inset 2px 0 4px rgba(255,255,255,0.03), 6px 0 18px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,0,0,0.55)", zIndex: 3 }}>
              {[18, 34, 50, 66, 82].map(pct => (
                <div key={pct} style={{ position: "absolute", left: "50%", top: `${pct}%`, transform: "translate(-50%,-50%)", width: "5px", height: "2px", backgroundColor: "rgba(201,162,39,0.22)" }} />
              ))}
            </div>

            {/* Pages area — perspective pivot at spine (50% = center crease) */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden", perspective: "1300px", perspectiveOrigin: "50% 50%" }}>

              {/* Paper backing */}
              <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "linear-gradient(to right, #ddc898 0%, #edddb0 40%, #f4e8c8 55%, #edddb0 75%, #ddc898 100%)" }} />

              {/* Shadow sweep — travels across pages as the turn animates */}
              <motion.div
                key={`sw-${shadowKey}`}
                initial={{ opacity: 0.5, x: pageDir === "forward" ? "-30%" : "30%" }}
                animate={{ opacity: 0, x: pageDir === "forward" ? "110%" : "-110%" }}
                transition={{ duration: 0.52, ease: [0.42, 0, 0.58, 1] }}
                style={{
                  position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none",
                  background: pageDir === "forward"
                    ? "linear-gradient(to right, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.15) 35%, transparent 65%)"
                    : "linear-gradient(to left, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.15) 35%, transparent 65%)",
                }}
              />
              {/* Crease shadow — lifting page casts a soft shadow onto the static page beneath it */}
              <motion.div
                key={`cs-${shadowKey}`}
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.52, ease: [0.42, 0, 0.58, 1] }}
                style={{
                  position: "absolute", top: 0, bottom: 0, zIndex: 18, pointerEvents: "none",
                  left: pageDir === "forward" ? "calc(50% - 18px)" : "calc(50% - 18px)",
                  width: "36px",
                  background: "radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, transparent 70%)",
                  filter: "blur(5px)",
                }}
              />

              {/* Static backdrop — always renders the destination spread; z-index 1 (underneath) */}
              <div style={{ position: "absolute", inset: 0, display: "flex", zIndex: 1 }}>
                {renderLeft(currentPage)}
                {renderRight(currentPage)}
              </div>

              {/* Turning page — only the physically turning half; no clipPath, pure rotateY on its own element */}
              {isFlipping && prevPage !== null && (
                <motion.div
                  key={flipKey}
                  initial={{ rotateY: 0 }}
                  animate={{ rotateY: pageDir === "forward" ? -180 : 180 }}
                  onAnimationComplete={() => setIsFlipping(false)}
                  transition={{ duration: 0.52, ease: [0.42, 0, 0.58, 1] }}
                  style={{
                    position: "absolute",
                    top: 0, bottom: 0,
                    left: pageDir === "forward" ? "50%" : 0,
                    width: "50%",
                    transformOrigin: pageDir === "forward" ? "0% 50%" : "100% 50%",
                    backfaceVisibility: "hidden",
                    pointerEvents: "none",
                    zIndex: 5,
                    display: "flex",
                    overflow: "hidden",
                  }}
                >
                  {pageDir === "forward" ? renderRight(prevPage) : renderLeft(prevPage)}
                </motion.div>
              )}

              
            </div>

            {/* Right leather cover edge */}
            <div style={{ width: "10px", flexShrink: 0, background: "linear-gradient(to right,#3a2010,#2a1608)", boxShadow: "inset 2px 0 6px rgba(0,0,0,0.4)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Detective handbook screen ────────────────────────────────────────────────
const HANDBOOK_SECTIONS = [
  { id: "techniques", title: "Investigation Techniques", desc: "Standard protocols for evidence gathering and verification.", locked: false },
  { id: "warnings", title: "Warning Signs", desc: "Common indicators of fabricated or tampered evidence.", locked: false },
  { id: "checklists", title: "Verification Checklists", desc: "Step-by-step procedures for authenticating documents and media.", locked: true },
  { id: "concepts", title: "Key Concepts", desc: "Core terminology and theoretical frameworks for digital investigation.", locked: true },
  { id: "memory", title: "Memory Tips", desc: "Mnemonic devices and cognitive aids for field operations.", locked: true },
  { id: "real-life", title: "Real-Life Application Tips", desc: "Translating digital investigation techniques to practical scenarios.", locked: true },
];

function HandbookScreen() {
  return (
    <div className="flex h-full items-center justify-center p-5" style={{ background: "radial-gradient(ellipse at center,#191008 0%,#07090f 100%)" }}>
      <div className="flex flex-col" style={{
        height: "88%", width: "100%", maxWidth: "960px",
        boxShadow: "0 24px 90px rgba(0,0,0,0.85), 0 0 0 1px rgba(201,162,39,0.2)",
        background: "linear-gradient(to right,#d0af8a 0%,#dbbe96 15%,#e8d5a3 50%,#dbbe96 85%,#d0af8a 100%)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Grain overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "repeating-linear-gradient(transparent,transparent 27px,rgba(80,50,18,0.16) 27px,rgba(80,50,18,0.16) 28px)",
        }} />
        
        {/* Leather spine overlay */}
        <div className="absolute left-0 top-0 bottom-0" style={{ width: "14px", background: "linear-gradient(to right,#2a1608,#3a2010)", boxShadow: "inset -4px 0 8px rgba(0,0,0,0.5), 2px 0 6px rgba(0,0,0,0.4)", zIndex: 10 }} />

        <div className="relative z-10 flex flex-col h-full pl-10 pr-6 py-8">
          <div style={{ fontFamily: "Special Elite, serif", fontSize: "28px", color: "#3a2010", letterSpacing: "0.12em", marginBottom: "4px" }}>
            DETECTIVE HANDBOOK
          </div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#5a3a1a", letterSpacing: "0.2em", marginBottom: "24px", opacity: 0.8 }}>
            PRECINCT 14 · FIELD MANUAL
          </div>

          <div className="flex-1 overflow-y-auto pr-4 flex flex-col gap-4" style={{ scrollbarWidth: "thin" }}>
            {HANDBOOK_SECTIONS.map((section) => (
              <div key={section.id} style={{
                border: `1px solid ${section.locked ? "rgba(90,58,26,0.15)" : "rgba(90,58,26,0.3)"}`,
                borderLeft: `4px solid ${section.locked ? "rgba(90,58,26,0.2)" : "#8a2810"}`,
                backgroundColor: section.locked ? "rgba(226,207,174,0.3)" : "rgba(242,237,226,0.6)",
                padding: "16px 20px",
                opacity: section.locked ? 0.6 : 1,
              }}>
                <div className="flex items-center justify-between mb-2">
                  <div style={{ fontFamily: "Special Elite, serif", fontSize: "20px", color: section.locked ? "#5a3a1a" : "#1a1005", letterSpacing: "0.05em" }}>
                    {section.title}
                  </div>
                  {section.locked && (
                    <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#8a2810", letterSpacing: "0.2em" }}>
                      CLASSIFIED
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#5a3a1a", lineHeight: 1.6 }}>
                  {section.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Evidence wall screen ─────────────────────────────────────────────────────
const WALL_NODE_POSITIONS = [
  { x: 12, y: 12, color: "#c9a227" },
  { x: 58, y: 20, color: "#e74c3c" },
  { x: 28, y: 50, color: "#9b59b6" },
  { x: 72, y: 38, color: "#c9b882" },
  { x: 44, y: 64, color: "#c9a227" },
  { x: 80, y: 58, color: "#e74c3c" },
  { x: 16, y: 72, color: "#c9b882" },
];

function EvidenceWallScreen({ cases }: { cases: CaseRecord[] }) {
  const solvedCases = cases.filter(c => c.status === "closed-solved");
  const activeNodes = solvedCases.map((c, i) => {
    const pos = WALL_NODE_POSITIONS[i % WALL_NODE_POSITIONS.length];
    const meta = CASES_CATALOG.find(m => m.caseId === c.caseId);
    return { id: i, label: meta?.title ?? c.caseId, x: pos.x, y: pos.y, color: pos.color };
  });
  const activeStrings: [number, number][] = activeNodes.length > 1
    ? activeNodes.slice(1).map((_, i) => [i, i + 1] as [number, number])
    : [];
  const shadowProgress = Math.min(100, Math.round((solvedCases.length / Math.max(CASES_CATALOG.length, 1)) * 100));

  return (
    <div className="flex flex-col h-full" style={{ background: "#060810" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid rgba(201,162,39,0.15)", flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "Special Elite, serif", fontSize: "22px", color: "#c9a227", letterSpacing: "0.07em" }}>
            CONSPIRACY BOARD — THE SHADOW NETWORK
          </div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#6b5f42", letterSpacing: "0.14em", marginTop: "2px" }}>
            OVERARCHING CONNECTIONS · CLUES PINNED FROM CLOSED CASES
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#6b5f42", letterSpacing: "0.1em" }}>STORY PROGRESSION</div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#c9a227", letterSpacing: "0.05em" }}>{shadowProgress}% UNCOVERED</div>
        </div>
      </div>

      {/* Cork wall */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0" style={{
          background: "linear-gradient(135deg,#191008 0%,#100c05 100%)",
          backgroundImage: "radial-gradient(circle 1px at 16px 16px, rgba(201,162,39,0.04) 0, transparent 0)",
          backgroundSize: "16px 16px",
        }} />

        {/* SVG strings */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {activeStrings.map(([a, b], i) => {
            const pa = activeNodes.find((n) => n.id === a)!;
            const pb = activeNodes.find((n) => n.id === b)!;
            if (!pa || !pb) return null;
            return (
              <line key={i}
                x1={`${pa.x + 4}%`} y1={`${pa.y + 2}%`}
                x2={`${pb.x + 4}%`} y2={`${pb.y + 2}%`}
                stroke={i % 4 === 0 ? "rgba(200,20,20,0.75)" : i % 4 === 1 ? "rgba(200,20,20,0.5)" : "rgba(200,20,20,0.35)"}
                strokeWidth={i % 4 === 0 ? "1.6" : "0.9"}
              />
            );
          })}
          {/* No selection rings — wall is reference only */}
        </svg>

        {/* Empty state */}
        {activeNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Special Elite, serif", fontSize: "18px", color: "rgba(201,162,39,0.22)", letterSpacing: "0.1em", marginBottom: "8px" }}>NO EVIDENCE YET</div>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "rgba(201,162,39,0.18)", letterSpacing: "0.2em" }}>SOLVE YOUR FIRST CASE TO PIN EVIDENCE HERE</div>
            </div>
          </div>
        )}

        {/* Evidence nodes — one per solved case, read-only */}
        {activeNodes.map((node) => {
          const rot = ((node.id * 7) % 9) - 4;
          return (
            <div key={node.id} className="absolute" style={{ left: `${node.x}%`, top: `${node.y + 4}%` }}>
              <div
                style={{
                  backgroundColor: "#e2cfae",
                  padding: "5px 8px",
                  minWidth: "78px",
                  transform: `rotate(${rot}deg)`,
                  boxShadow: `0 0 0 1px ${node.color}45, 3px 4px 12px rgba(0,0,0,0.72)`,
                  cursor: "default",
                  position: "relative",
                  transition: "transform 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.transform = `rotate(0deg) scale(1.05)`}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.transform = `rotate(${rot}deg) scale(1)`}
              >
                <div style={{ position: "absolute", top: "-5px", left: "50%", transform: "translateX(-50%)", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: node.color, boxShadow: `0 0 5px ${node.color}80` }} />
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#1a1005", textAlign: "center", lineHeight: 1.45 }}>{node.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center px-5 py-2.5" style={{ borderTop: "1px solid rgba(201,162,39,0.15)", flexShrink: 0 }}>
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#3a3428", letterSpacing: "0.08em" }}>
          CONNECTIONS: {activeStrings.length} · FLAGGED NODES: {activeNodes.filter(n => n.color === "#e74c3c").length}
        </div>
      </div>
    </div>
  );
}

// ─── Mira onboarding screen ───────────────────────────────────────────────────
const MIRA_ONBOARDING_MSG = "Welcome, Detective. Before we send you into the field, there's one rule every Digital Guardian must remember. Information is powerful. Used responsibly, it can save lives. Used carelessly, it can create fear, confusion, and harm. During every mission, you'll investigate clues, analyze evidence, and make a final decision. There are no trick questions. Only careful observation.";

function MiraOnboardingScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "radial-gradient(ellipse at 50% 40%, #191008 0%, #07090f 100%)" }}>
      <Grain /><ScanLines /><Vignette />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        style={{ maxWidth: "580px", width: "100%", padding: "0 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: "28px" }}
      >
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "8.5px", color: "rgba(201,162,39,0.45)", letterSpacing: "0.32em", marginBottom: "8px" }}>
            BUREAU ORIENTATION · FIELD DIVISION
          </div>
          <div style={{ fontFamily: "Special Elite, serif", fontSize: "24px", color: "#c9a227", letterSpacing: "0.1em", animation: "amber-glow 2.4s ease-in-out infinite" }}>
            COMMANDER BRIEFING
          </div>
        </div>

        {/* Mira message */}
        <MiraPopup message={MIRA_ONBOARDING_MSG} />

        {/* CTA */}
        <button
          onClick={onDone}
          style={{
            fontFamily: "Special Elite, serif", fontSize: "18px", letterSpacing: "0.22em",
            color: "#07090f", backgroundColor: "#c9a227",
            border: "none", padding: "13px 48px", cursor: "pointer",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#ffd966"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#c9a227"; }}
        >
          READY?
        </button>
      </motion.div>
    </div>
  );
}

// ─── Boot sequence screen ─────────────────────────────────────────────────────
function BootScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0); // 0=blank 1=line1 2=line2 3=line3 4=fading

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 380);
    const t2 = setTimeout(() => setPhase(2), 1020);
    const t3 = setTimeout(() => setPhase(3), 1680);
    const t4 = setTimeout(() => onDone(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onDone]);

  const LINES = [
    { text: "SECURE CONNECTION ESTABLISHED", amber: false },
    { text: "Connecting to Bureau Network...",  amber: false },
    { text: "Identity Verified.",               amber: true  },
  ];

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ backgroundColor: "#07090f", cursor: "pointer" }}
      onClick={onDone}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "9px", width: "min(440px, 88vw)" }}>
        {LINES.map((l, i) => (
          <div key={i} style={{
            fontFamily: "Courier Prime, monospace",
            fontSize: "13px",
            letterSpacing: "0.1em",
            color: l.amber ? "#c9a227" : "#b8a878",
            opacity: phase > i ? 1 : 0,
            transition: "opacity 0.52s ease",
            textShadow: l.amber && phase > i ? "0 0 8px rgba(201,162,39,0.55)" : "none",
            display: "flex",
            gap: "10px",
          }}>
            <span style={{ color: "rgba(201,162,39,0.38)", flexShrink: 0 }}>&gt;</span>
            <span>{l.text}</span>
          </div>
        ))}
      </div>
      {phase >= 3 && (
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", letterSpacing: "0.22em", color: "rgba(201,162,39,0.28)", marginTop: "36px" }}>
          TAP TO CONTINUE
        </div>
      )}
    </div>
  );
}

// ─── Splash screen ────────────────────────────────────────────────────────────
function SplashScreen({ onDone }: { onDone: () => void }) {
  const [barW, setBarW] = useState(0);

  useEffect(() => {
    // Animate bar to 100% over ~1.4s then call onDone
    let raf: number;
    let start: number | null = null;
    const duration = 1400;
    const step = (ts: number) => {
      if (!start) start = ts;
      const pct = Math.min(((ts - start) / duration) * 100, 100);
      setBarW(pct);
      if (pct < 100) {
        raf = requestAnimationFrame(step);
      } else {
        setTimeout(onDone, 180);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ backgroundColor: "#07090f", cursor: "pointer" }}
      onClick={onDone}
    >
      {/* Faint badge ring behind wordmark */}
      <div style={{
        position: "absolute",
        width: "320px", height: "320px",
        border: "1px solid rgba(201,162,39,0.07)",
        borderRadius: "50%",
      }} />
      <div style={{
        position: "absolute",
        width: "260px", height: "260px",
        border: "1px solid rgba(201,162,39,0.05)",
        borderRadius: "50%",
      }} />

      {/* Precinct stamp arc text — top */}
      <div style={{
        fontFamily: "Courier Prime, monospace",
        fontSize: "10px",
        letterSpacing: "0.35em",
        color: "rgba(201,162,39,0.35)",
        marginBottom: "18px",
        textTransform: "uppercase",
      }}>
        ·&nbsp;PRECINCT&nbsp;14&nbsp;·&nbsp;DIVISION&nbsp;OF&nbsp;DIGITAL&nbsp;INVESTIGATIONS&nbsp;·
      </div>

      {/* Main wordmark */}
      <div style={{ transform: "rotate(-4deg)", textAlign: "center" }}>
        <div
          className="amber-glow"
          style={{
            fontFamily: "Special Elite, serif",
            fontSize: "clamp(3.5rem, 8vw, 6.5rem)",
            color: "#ffd966",
            letterSpacing: "0.08em",
            lineHeight: 1,
          }}
        >
          DIGITAL
        </div>
        <div
          className="amber-glow"
          style={{
            fontFamily: "Special Elite, serif",
            fontSize: "clamp(3.5rem, 8vw, 6.5rem)",
            color: "#ffd966",
            letterSpacing: "0.08em",
            lineHeight: 1,
          }}
        >
          DETECTIVE
        </div>
      </div>

      {/* Tagline */}
      <div style={{
        fontFamily: "Courier Prime, monospace",
        fontSize: "9.5px",
        letterSpacing: "0.28em",
        color: "#b8a878",
        marginTop: "22px",
        marginBottom: "36px",
      }}>
        TRUTH IS EVIDENCE. EVERYTHING ELSE IS NOISE.
      </div>

      {/* Loading bar */}
      <div style={{
        width: "260px",
        height: "2px",
        backgroundColor: "rgba(201,162,39,0.12)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute",
          left: 0, top: 0, bottom: 0,
          width: `${barW}%`,
          background: "linear-gradient(to right, #c9a227, #00e9ff)",
          transition: "width 0.04s linear",
          boxShadow: "0 0 8px rgba(0,233,255,0.5)",
        }} />
      </div>

      {/* Tap hint */}
      <div style={{
        fontFamily: "Courier Prime, monospace",
        fontSize: "9.5px",
        letterSpacing: "0.2em",
        color: "rgba(201,162,39,0.3)",
        marginTop: "14px",
      }}>
        TAP TO CONTINUE
      </div>

      {/* Corner case number */}
      <div className="absolute bottom-4 right-4" style={{
        fontFamily: "Courier Prime, monospace",
        fontSize: "9px",
        letterSpacing: "0.15em",
        color: "rgba(201,162,39,0.18)",
      }}>
        VER 1.0.0 · CASE ENGINE REV 14
      </div>
    </div>
  );
}

// ─── Animated menu background ────────────────────────────────────────────────
function MenuAnimatedBg({ reduceMotion = false }: { reduceMotion?: boolean }) {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [drawStrings, setDrawStrings] = useState(false);
  const [brightString, setBrightString] = useState(-1);

  useEffect(() => {
    if (reduceMotion) return;
    const onMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const t = setTimeout(() => setDrawStrings(true), 500);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    let timer: ReturnType<typeof setTimeout>;
    let idx = 0;
    const cycle = () => {
      setBrightString(idx % 5);
      idx++;
      timer = setTimeout(() => {
        setBrightString(-1);
        timer = setTimeout(cycle, 15000 + Math.random() * 5000);
      }, 1000);
    };
    timer = setTimeout(cycle, 4000);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  const folders = [
    { left: "71%", top: "10%", rot: -8,  delay: "0s",   scale: 0.95 },
    { left: "80%", top: "55%", rot:  5,  delay: "3.5s", scale: 1.05 },
    { left: "3%",  top: "62%", rot: -4,  delay: "7s",   scale: 0.74 },
    { left: "57%", top: "73%", rot: 11,  delay: "1.8s", scale: 0.62 },
  ];

  const nearX = reduceMotion ? 0 : (mousePos.x - 0.5) * -12;
  const nearY = reduceMotion ? 0 : (mousePos.y - 0.5) * -8;
  const midX  = reduceMotion ? 0 : (mousePos.x - 0.5) * -5;
  const midY  = reduceMotion ? 0 : (mousePos.y - 0.5) * -3;

  const STRINGS = [
    { x1: "13%", y1: "22%", x2: "63%", y2: "42%", w: "1.4", len: 340 },
    { x1: "63%", y1: "42%", x2: "84%", y2: "15%", w: "1.0", len: 240 },
    { x1: "13%", y1: "22%", x2: "37%", y2: "72%", w: "0.8", len: 300 },
    { x1: "37%", y1: "72%", x2: "60%", y2: "60%", w: "1.2", len: 210 },
    { x1: "60%", y1: "60%", x2: "88%", y2: "28%", w: "0.7", len: 280 },
  ];

  const PIN_ENDPOINTS = [
    { x: "11%", y: "19%", rot: -5 },
    { x: "61%", y: "39%", rot:  4 },
    { x: "35%", y: "69%", rot: -3 },
    { x: "82%", y: "12%", rot:  6 },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>

      {/* FAR LAYER — grid pan */}
      <div className={`absolute inset-0 ${reduceMotion ? "" : "mbg-grid-pan"}`} style={{
        backgroundImage: "radial-gradient(circle 1px at 20px 20px, rgba(201,162,39,0.055) 0, transparent 0)",
        backgroundSize: "20px 20px",
      }} />

      {/* Far: city window-light silhouette in back corner */}
      <div className="absolute" style={{ right: "0", top: "0", opacity: 0.038, transform: `translate(${midX * 0.3}px, ${midY * 0.3}px)` }}>
        <svg width="260" height="200" viewBox="0 0 260 200" fill="none" stroke="rgba(201,162,39,1)" strokeWidth="1.5">
          <rect x="8" y="8" width="110" height="84" /><line x1="63" y1="8" x2="63" y2="92" /><line x1="8" y1="50" x2="118" y2="50" />
          <rect x="138" y="8" width="110" height="84" /><line x1="193" y1="8" x2="193" y2="92" /><line x1="138" y1="50" x2="248" y2="50" />
          <rect x="8" y="112" width="110" height="80" /><line x1="63" y1="112" x2="63" y2="192" /><line x1="8" y1="152" x2="118" y2="152" />
        </svg>
      </div>

      {/* MID LAYER — ambient lamp glow */}
      <div className={`absolute ${reduceMotion ? "" : "mbg-glass-drift"}`} style={{
        left: "-20%", top: "-10%", width: "140%", height: "140%",
        background: "radial-gradient(ellipse at 52% 28%, rgba(201,162,39,0.1) 0%, transparent 55%)",
        animationDuration: "25s",
        transform: `translate(${midX}px, ${midY}px)`,
      }} />
      {/* Lamp hot-spot — irregular flicker, repositioned above NEW CASE tile */}
      <div className={reduceMotion ? "absolute" : "absolute lamp-hot"} style={{
        left: "25%", top: "0%", width: "52%", height: "55%",
        background: "radial-gradient(ellipse at 50% 35%, rgba(201,162,39,0.13) 0%, transparent 52%)",
        transform: `translate(${midX}px, ${midY}px)`,
      }} />

      {/* Magnifying glass — mid */}
      <div style={{ transform: `translate(${midX}px, ${midY}px)` }}>
        <div className={`absolute ${reduceMotion ? "" : "mbg-glass-drift"}`} style={{ left: "3%", top: "18%", opacity: 0.11 }}>
          <svg width="148" height="168" viewBox="0 0 148 168" fill="none">
            <circle cx="60" cy="60" r="46" stroke="#c9a227" strokeWidth="9"/>
            <circle cx="60" cy="60" r="46" fill="rgba(201,162,39,0.04)"/>
            <circle cx="44" cy="40" r="10" fill="rgba(255,217,102,0.07)"/>
            <line x1="95" y1="95" x2="140" y2="140" stroke="#c9a227" strokeWidth="11" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Typewriter — mid */}
      <div style={{ transform: `translate(${midX}px, ${midY}px)` }}>
        <div className={`absolute ${reduceMotion ? "" : "mbg-glass-drift"}`} style={{ left: "60%", top: "60%", opacity: 0.08, animationDelay: "-10s" }}>
          <svg width="180" height="140" viewBox="0 0 180 140" fill="none" stroke="#c9a227" strokeWidth="3">
            <rect x="20" y="50" width="140" height="70" rx="10" />
            <path d="M40 50 L50 20 L130 20 L140 50" />
            <line x1="40" y1="80" x2="140" y2="80" />
            <line x1="50" y1="95" x2="130" y2="95" />
            <line x1="60" y1="110" x2="120" y2="110" />
            <rect x="55" y="5" width="70" height="30" fill="rgba(201,162,39,0.05)" />
          </svg>
        </div>
      </div>

      {/* Rotary Phone — mid */}
      <div style={{ transform: `translate(${midX}px, ${midY}px)` }}>
        <div className={`absolute ${reduceMotion ? "" : "mbg-glass-drift"}`} style={{ left: "15%", top: "75%", opacity: 0.06, animationDelay: "-5s" }}>
          <svg width="120" height="100" viewBox="0 0 120 100" fill="none" stroke="#c9a227" strokeWidth="3">
            <path d="M20 50 C20 30, 100 30, 100 50 L110 90 L10 90 Z" />
            <circle cx="60" cy="65" r="20" /><circle cx="60" cy="53" r="3" /><circle cx="70" cy="60" r="3" />
            <circle cx="72" cy="70" r="3" />
            <path d="M10 40 C10 10, 110 10, 110 40 L115 50 L105 50 C105 25, 15 25, 15 50 Z" />
          </svg>
        </div>
      </div>

      {/* NEW: Police radio/scanner — mid */}
      <div style={{ transform: `translate(${midX}px, ${midY}px)` }}>
        <div className={`absolute ${reduceMotion ? "" : "mbg-folder-float"}`} style={{ right: "5%", top: "42%", opacity: 0.07, "--f-rot": "4deg", animationDelay: "-11s" } as React.CSSProperties}>
          <svg width="110" height="80" viewBox="0 0 110 80" fill="none" stroke="#c9a227" strokeWidth="2">
            <rect x="5" y="20" width="100" height="55" rx="4" />
            <rect x="15" y="30" width="40" height="25" rx="2" />
            <circle cx="80" cy="42" r="10" /><circle cx="80" cy="42" r="5" />
            <line x1="65" y1="60" x2="95" y2="60" />
            <line x1="5" y1="20" x2="35" y2="5" /><line x1="35" y1="5" x2="50" y2="20" />
          </svg>
        </div>
      </div>

      {/* NEW: Open manila folder + clipped photo — mid */}
      <div style={{ transform: `translate(${midX}px, ${midY}px)` }}>
        <div className={`absolute ${reduceMotion ? "" : "mbg-folder-float"}`} style={{ left: "42%", top: "68%", opacity: 0.08, "--f-rot": "-7deg", animationDelay: "-6s" } as React.CSSProperties}>
          <svg width="96" height="74" viewBox="0 0 96 74" fill="none" stroke="#c9a227" strokeWidth="2">
            <rect x="2" y="18" width="92" height="54" />
            <path d="M2 18 L2 8 L32 8 L38 18Z" />
            <rect x="14" y="26" width="42" height="32" />
            <line x1="14" y1="34" x2="56" y2="34" /><line x1="14" y1="42" x2="56" y2="42" />
            <path d="M62 24 C62 20, 68 20, 68 24 L68 50 C68 56, 58 56, 58 50 L58 28 C58 24, 72 22, 72 28 L72 52" />
          </svg>
        </div>
      </div>

      {/* NEW: Stacked case files + magnifying glass on top — mid */}
      <div style={{ transform: `translate(${midX}px, ${midY}px)` }}>
        <div className={`absolute ${reduceMotion ? "" : "mbg-folder-float"}`} style={{ right: "4%", top: "58%", opacity: 0.07, "--f-rot": "3deg", animationDelay: "-17s" } as React.CSSProperties}>
          <svg width="100" height="120" viewBox="0 0 100 120" fill="none" stroke="#c9a227" strokeWidth="2">
            <rect x="8" y="42" width="84" height="70" /><rect x="4" y="37" width="84" height="70" /><rect x="0" y="32" width="84" height="70" />
            <line x1="10" y1="48" x2="74" y2="48" /><line x1="10" y1="56" x2="60" y2="56" /><line x1="10" y1="64" x2="70" y2="64" />
            <circle cx="68" cy="22" r="16" />
            <line x1="79" y1="33" x2="90" y2="44" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* NEW: Corkboard pushpin cluster — mid */}
      <div style={{ transform: `translate(${midX}px, ${midY}px)` }}>
        <div className={`absolute ${reduceMotion ? "" : "mbg-folder-float"}`} style={{ left: "26%", top: "8%", opacity: 0.08, "--f-rot": "0deg", animationDelay: "-20s" } as React.CSSProperties}>
          <svg width="70" height="60" viewBox="0 0 70 60" fill="none" stroke="#c9a227" strokeWidth="2">
            <circle cx="15" cy="15" r="5" /><line x1="15" y1="20" x2="15" y2="35" />
            <circle cx="40" cy="10" r="5" /><line x1="40" y1="15" x2="40" y2="30" />
            <circle cx="58" cy="22" r="5" /><line x1="58" y1="27" x2="58" y2="42" />
            <circle cx="28" cy="40" r="5" /><line x1="28" y1="45" x2="28" y2="58" />
            <line x1="15" y1="15" x2="40" y2="10" strokeDasharray="3,2" opacity="0.5" />
            <line x1="40" y1="10" x2="58" y2="22" strokeDasharray="3,2" opacity="0.5" />
            <line x1="15" y1="15" x2="28" y2="40" strokeDasharray="3,2" opacity="0.5" />
          </svg>
        </div>
      </div>

      {/* Coffee ring stain — mid */}
      <div style={{ transform: `translate(${midX * 0.6}px, ${midY * 0.6}px)` }}>
        <div className={`absolute ${reduceMotion ? "" : "mbg-folder-float"}`} style={{ left: "45%", top: "35%", opacity: 0.15, "--f-rot": "15deg" } as React.CSSProperties}>
          <div style={{ width: "90px", height: "90px", borderRadius: "50%", border: "4px solid rgba(80,50,18,0.4)", borderRightColor: "transparent", transform: "rotate(45deg)", filter: "blur(1px)" }} />
          <div style={{ position: "absolute", top: "10%", left: "10%", width: "80px", height: "80px", borderRadius: "50%", border: "2px solid rgba(80,50,18,0.2)", borderBottomColor: "transparent" }} />
        </div>
      </div>

      {/* Folder silhouettes — mid */}
      {folders.map((f, i) => (
        <div key={i} style={{ transform: `translate(${midX}px, ${midY}px)` }}>
          <div className={`absolute ${reduceMotion ? "" : "mbg-folder-float"}`} style={{
            left: f.left, top: f.top, opacity: 0.09,
            transform: `rotate(${f.rot}deg) scale(${f.scale})`,
            "--f-rot": `${f.rot}deg`,
            animationDelay: f.delay,
          } as React.CSSProperties}>
            <svg width="88" height="76" viewBox="0 0 88 76" fill="none">
              <rect x="0" y="17" width="88" height="59" fill="#c9a227"/>
              <rect x="0" y="6" width="38" height="17" fill="#c9a227"/>
              <rect x="8" y="28" width="72" height="2" fill="rgba(0,0,0,0.15)"/>
              <rect x="8" y="36" width="54" height="2" fill="rgba(0,0,0,0.1)"/>
              <rect x="8" y="44" width="66" height="2" fill="rgba(0,0,0,0.1)"/>
            </svg>
          </div>
        </div>
      ))}

      {/* Fingerprint card — mid */}
      <div style={{ transform: `translate(${midX}px, ${midY}px)` }}>
        <div className={`absolute ${reduceMotion ? "" : "mbg-folder-float"}`} style={{ right: "8%", top: "28%", opacity: 0.07, "--f-rot": "-6deg", animationDelay: "-9s", transform: "rotate(-6deg)" } as React.CSSProperties}>
          <svg width="100" height="70" viewBox="0 0 100 70" fill="none" stroke="#c9a227" strokeWidth="2">
            <rect x="2" y="2" width="96" height="66" rx="2"/>
            <line x1="10" y1="14" x2="90" y2="14"/>
            <ellipse cx="50" cy="42" rx="22" ry="18"/><ellipse cx="50" cy="42" rx="14" ry="11"/><ellipse cx="50" cy="42" rx="7" ry="5"/>
            <line x1="10" y1="60" x2="38" y2="60"/><line x1="62" y1="60" x2="90" y2="60"/>
          </svg>
        </div>
      </div>

      {/* Evidence tag — mid */}
      <div style={{ transform: `translate(${midX}px, ${midY}px)` }}>
        <div className={`absolute ${reduceMotion ? "" : "mbg-folder-float"}`} style={{ left: "38%", top: "12%", opacity: 0.10, "--f-rot": "8deg", animationDelay: "-14s", transform: "rotate(8deg)" } as React.CSSProperties}>
          <svg width="70" height="44" viewBox="0 0 70 44" fill="none" stroke="#c9a227" strokeWidth="2">
            <path d="M10 4 L60 4 L66 22 L60 40 L10 40 L4 22 Z"/>
            <circle cx="14" cy="22" r="4"/>
            <line x1="22" y1="14" x2="56" y2="14"/><line x1="22" y1="22" x2="56" y2="22"/><line x1="22" y1="30" x2="44" y2="30"/>
          </svg>
        </div>
      </div>

      {/* NEAR LAYER — large open folder, higher opacity, slower, near parallax */}
      <div style={{ transform: `translate(${nearX}px, ${nearY}px)` }}>
        <div className={`absolute ${reduceMotion ? "" : "mbg-folder-float"}`} style={{
          left: "-3%", top: "28%", opacity: 0.16, "--f-rot": "-5deg",
          animationDuration: "22s", animationDelay: "-8s",
          transform: "rotate(-5deg) scale(1.7)",
        } as React.CSSProperties}>
          <svg width="88" height="76" viewBox="0 0 88 76" fill="none">
            <rect x="0" y="17" width="88" height="59" fill="#c9a227"/>
            <rect x="0" y="6" width="38" height="17" fill="#c9a227"/>
            <rect x="8" y="28" width="72" height="2" fill="rgba(0,0,0,0.15)"/>
            <rect x="8" y="36" width="54" height="2" fill="rgba(0,0,0,0.1)"/>
            <rect x="8" y="44" width="66" height="2" fill="rgba(0,0,0,0.1)"/>
          </svg>
        </div>
      </div>

      {/* Additional far-right folder — kept, mid parallax */}
      <div style={{ transform: `translate(${midX}px, ${midY}px)` }}>
        <div className={`absolute ${reduceMotion ? "" : "mbg-folder-float"}`} style={{ right: "22%", bottom: "5%", opacity: 0.06, "--f-rot": "-12deg", animationDelay: "-4s", transform: "rotate(-12deg) scale(1.4)" } as React.CSSProperties}>
          <svg width="88" height="76" viewBox="0 0 88 76" fill="none">
            <rect x="0" y="17" width="88" height="59" fill="#c9a227"/>
            <rect x="0" y="6" width="38" height="17" fill="#c9a227"/>
            <rect x="8" y="28" width="72" height="2" fill="rgba(0,0,0,0.15)"/>
            <rect x="8" y="36" width="48" height="2" fill="rgba(0,0,0,0.1)"/>
            <rect x="8" y="44" width="60" height="2" fill="rgba(0,0,0,0.1)"/>
          </svg>
        </div>
      </div>

      {/* String photo-endpoint chips */}
      {PIN_ENDPOINTS.map((p, i) => (
        <div key={i} className="absolute" style={{
          left: p.x, top: p.y,
          transform: `rotate(${p.rot}deg) translate(${midX * 0.6}px, ${midY * 0.6}px)`,
          opacity: 0.13,
        }}>
          <div style={{ width: "28px", height: "20px", backgroundColor: "#e2cfae", border: "1px solid rgba(201,162,39,0.4)", position: "relative" }}>
            <div style={{ position: "absolute", top: "-4px", left: "50%", transform: "translateX(-50%)", width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#c9a227" }} />
          </div>
        </div>
      ))}

      {/* Red strings — staggered draw-in + per-string brightness pulse */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" style={{ overflow: "visible" }}>
        {STRINGS.map((s, i) => (
          <line
            key={i}
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke="rgba(210,20,20,1)"
            strokeWidth={s.w}
            strokeDasharray={s.len}
            strokeDashoffset={drawStrings ? 0 : s.len}
            opacity={brightString === i ? 0.50 : 0.055}
            style={{
              transition: drawStrings
                ? `stroke-dashoffset 0.85s ease-out ${i * 0.3}s, opacity 0.35s ease`
                : "none",
            }}
          />
        ))}
      </svg>
    </div>
  );
}

// ─── Recruitment letter screen ────────────────────────────────────────────────
function RecruitmentLetterScreen({ onAccept }: { onAccept: () => void }) {
  const [stamped, setStamped] = useState(false);

  const handleAccept = () => {
    if (stamped) return;
    setStamped(true);
    setTimeout(onAccept, 1800);
  };

  return (
    <>
    <RecruitmentIntro>
      <div className="flex items-start justify-center min-h-full py-4 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          width: "min(540px, 96vw)", flexShrink: 0,
          background: "linear-gradient(170deg,#ead7b4 0%,#d9c49c 100%)",
          padding: "20px 28px",
          position: "relative",
          boxShadow: "0 32px 100px rgba(0,0,0,0.92), 0 0 0 1px rgba(201,162,39,0.26)",
        }}
      >
        {/* Aged paper edges */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"5px",
          background:"linear-gradient(to right,#a87c48,#c9af7e,#9e6f38,#c9af7e,#a87c48)" }} />
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"4px",
          background:"linear-gradient(to right,#a87c48,#c0a86c,#9e6f38,#c0a86c,#a87c48)" }} />

        {/* Classification header */}
        <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"7px", letterSpacing:"0.3em",
          color:"#5a3a1a", textAlign:"center", marginBottom:"12px", opacity:0.6 }}>
          BUREAU OF DIGITAL INVESTIGATIONS · PRECINCT 14 · CONFIDENTIAL
        </div>

        {/* Title stamp */}
        <div style={{ display:"inline-block", transform:"rotate(-2.5deg)", marginBottom:"14px",
          borderBottom:"2px solid rgba(90,58,26,0.28)", paddingBottom:"8px" }}>
          <div style={{ fontFamily:"Special Elite,serif", fontSize:"20px", color:"#1a1005", letterSpacing:"0.08em", lineHeight:1.2 }}>
            RECRUITMENT NOTICE
          </div>
          <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"7px", color:"#5a3a1a",
            letterSpacing:"0.18em", marginTop:"3px", opacity:0.65 }}>
            REF: 2024-DDI-RECRUIT-001
          </div>
        </div>

        {/* Date */}
        <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"8.5px", color:"#3a2510",
          opacity:0.58, marginBottom:"10px" }}>
          {new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}).toUpperCase()}
          {" "}· EYES ONLY
        </div>

        {/* Salutation */}
        <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"10px", color:"#2a1a0a", lineHeight:1.8, marginBottom:"10px" }}>
          To Whom It May Concern,
        </div>

        {/* Body */}
        <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"10px", color:"#2a1a0a", lineHeight:1.85 }}>
          <p style={{ marginBottom:"10px" }}>
            Fabricated stories, manipulated images, and coordinated disinformation campaigns
            spread faster than any correction can follow. Trust in public institutions is
            eroding — not because truth is hard to find, but because falsehood is engineered
            to look indistinguishable from it.
          </p>
          <p style={{ marginBottom:"10px" }}>
            You have been identified as a candidate of exceptional observational acuity and
            critical reasoning capability. The Division of Digital Investigations trains
            Detectives to identify fabricated evidence, trace disinformation networks, and
            protect public discourse from coordinated deception. Your assignment: expose
            the Shadow Network before its influence becomes irreversible.
          </p>

          {/* Mission activities — left-ruled list */}
          <div style={{ borderLeft:"2px solid rgba(90,58,26,0.3)", paddingLeft:"12px", marginBottom:"10px" }}>
            <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"7.5px", letterSpacing:"0.2em", color:"#5a3a1a", marginBottom:"6px", opacity:0.7 }}>
              WHAT YOUR MISSIONS WILL REQUIRE:
            </div>
            {[
              "Examine evidence — separate verified fact from fabrication",
              "Verify sources — trace provenance chains and flag anomalies",
              "Spot manipulation — recognise altered images and planted data",
              "Question assumptions — every witness, timestamp, and motive",
            ].map((item, i) => (
              <div key={i} style={{ display:"flex", gap:"8px", marginBottom:"4px" }}>
                <span style={{ color:"#c9a227", flexShrink:0 }}>·</span>
                <span style={{ fontSize:"9.5px", color:"#3a2510" }}>{item}</span>
              </div>
            ))}
          </div>

          <p style={{ marginBottom:"14px" }}>
            Should you choose to accept, you will be assigned to Precinct 14 under the
            direct supervision of Chief Morgan. Your first case awaits briefing.
            This offer expires at 0600 hours.
          </p>
        </div>

        {/* Academy motto — stamped quote block */}
        <div style={{ borderTop:"1px solid rgba(90,58,26,0.22)", borderBottom:"1px solid rgba(90,58,26,0.22)", padding:"10px 0", marginBottom:"14px", textAlign:"center" }}>
          <div style={{ fontFamily:"Special Elite,serif", fontSize:"13px", color:"#3a2510", letterSpacing:"0.08em", transform:"rotate(-1.5deg)", lineHeight:1.5, opacity:0.82 }}>
            "Don't believe everything you see.<br />Verify before you trust."
          </div>
          <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"7px", letterSpacing:"0.22em", color:"#5a3a1a", marginTop:"5px", opacity:0.55 }}>
            — PRECINCT 14 ACADEMY MOTTO
          </div>
        </div>

        {/* Signature */}
        <div style={{ fontFamily:"Caveat,cursive", fontSize:"18px", color:"#3a2510", paddingBottom:"10px", marginBottom:"14px" }}>
          Chief D. Morgan
          <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"7px", color:"#5a3a1a", letterSpacing:"0.14em", marginTop:"3px", opacity:0.6 }}>
            DIV. OF DIGITAL INVESTIGATIONS · PRECINCT 14
          </div>
        </div>

        {/* Begin Training button */}
        <div style={{ textAlign:"center" }}>
          <button onClick={handleAccept} disabled={stamped} style={{
            fontFamily:"Special Elite,serif", fontSize:"14px", letterSpacing:"0.24em",
            color: stamped ? "rgba(90,58,26,0.32)" : "#1a1005",
            border: `2px solid ${stamped ? "rgba(90,58,26,0.22)" : "rgba(90,58,26,0.62)"}`,
            backgroundColor: stamped ? "rgba(90,58,26,0.04)" : "rgba(201,162,39,0.18)",
            padding:"12px 36px", cursor: stamped ? "default" : "pointer", transition:"all 0.18s",
          }}
            onMouseEnter={(e) => { if (!stamped) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(201,162,39,0.34)"; }}
            onMouseLeave={(e) => { if (!stamped) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(201,162,39,0.18)"; }}
          >
            BEGIN TRAINING
          </button>
        </div>
      </motion.div>
      </div>
    </RecruitmentIntro>

      {/* Stamp overlay — reuses same spring pattern as StampOverlay */}
      <AnimatePresence>
        {stamped && (
          <motion.div className="fixed inset-0 flex flex-col items-center justify-center"
            style={{ zIndex:300, backgroundColor:"rgba(0,0,0,0.80)" }}
            initial={{ opacity:0 }} animate={{ opacity:1 }}
          >
            <motion.div
              initial={{ scale:4, rotate:-13, opacity:0 }}
              animate={{ scale:1, rotate:-7, opacity:1 }}
              transition={{ type:"spring", stiffness:520, damping:22 }}
              style={{
                fontFamily:"Special Elite,serif",
                fontSize:"clamp(3rem,8vw,5.5rem)",
                color:"#c9a227", border:"8px solid #c9a227",
                padding:"0.22em 0.65em", letterSpacing:"0.12em", lineHeight:1,
                boxShadow:"0 0 70px rgba(201,162,39,0.55)",
                backgroundColor:"rgba(7,9,15,0.94)",
                marginBottom:"24px",
              }}
            >
              ACCEPTED
            </motion.div>
            <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"8.5px",
              letterSpacing:"0.26em", color:"#6b5f42" }}>
              TRAINING ACCEPTED — PROCEEDING TO PROFILE
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Profile creation screen ──────────────────────────────────────────────────
function AvatarTile({ idx, selected, onSelect }: { idx: number; selected: boolean; onSelect: () => void }) {
  // Eight passport-photo style faces (4 human, 4 animal), all sharing the same
  // ID-photo corner marks and a common head circle so every option lines up.
  const cornerMarks = (
    <>
      <path d="M5,12 V6 H11" />
      <path d="M41,12 V6 H35" />
      <path d="M5,48 V54 H11" />
      <path d="M41,48 V54 H35" />
    </>
  );
  const avatars = [
    // 0 man — short neat hair
    <svg key={0} width="46" height="60" viewBox="0 0 46 60" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {cornerMarks}
      <circle cx="23" cy="30" r="14" fill="currentColor" fillOpacity="0.10"/>
      <path d="M9,27 Q9,13 23,13 Q37,13 37,27 L34,22 Q29,17 23,18 Q17,17 12,22 Z" fill="currentColor" fillOpacity="0.28"/>
      <circle cx="17.5" cy="29" r="1.3" fill="currentColor" stroke="none"/>
      <circle cx="28.5" cy="29" r="1.3" fill="currentColor" stroke="none"/>
      <line x1="23" y1="31" x2="23" y2="35"/>
      <path d="M18,38.5 Q23,41.5 28,38.5" />
    </svg>,
    // 1 man — mustache, receding hairline
    <svg key={1} width="46" height="60" viewBox="0 0 46 60" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {cornerMarks}
      <circle cx="23" cy="30" r="14" fill="currentColor" fillOpacity="0.10"/>
      <path d="M10,23 Q10,14 16,13" fill="none"/>
      <path d="M36,23 Q36,14 30,13" fill="none"/>
      <circle cx="17.5" cy="28" r="1.3" fill="currentColor" stroke="none"/>
      <circle cx="28.5" cy="28" r="1.3" fill="currentColor" stroke="none"/>
      <line x1="23" y1="30" x2="23" y2="34"/>
      <path d="M17,36.5 Q23,39.5 29,36.5" strokeWidth="2.6" fill="none"/>
    </svg>,
    // 2 woman — long hair
    <svg key={2} width="46" height="60" viewBox="0 0 46 60" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {cornerMarks}
      <path d="M8,26 Q6,13 23,12 Q40,13 38,26 L38,47 Q34,34 23,34 Q12,34 8,47 Z" fill="currentColor" fillOpacity="0.22"/>
      <circle cx="23" cy="30" r="14" fill="currentColor" fillOpacity="0.10"/>
      <circle cx="17.5" cy="29" r="1.3" fill="currentColor" stroke="none"/>
      <circle cx="28.5" cy="29" r="1.3" fill="currentColor" stroke="none"/>
      <line x1="23" y1="31" x2="23" y2="35"/>
      <path d="M18,38.5 Q23,41.5 28,38.5" />
    </svg>,
    // 3 woman — short bob
    <svg key={3} width="46" height="60" viewBox="0 0 46 60" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {cornerMarks}
      <path d="M8,26 Q7,12 23,12 Q39,12 38,26 L37,41 L9,41 Z" fill="currentColor" fillOpacity="0.24"/>
      <circle cx="23" cy="30" r="14" fill="currentColor" fillOpacity="0.10"/>
      <circle cx="17.5" cy="29" r="1.3" fill="currentColor" stroke="none"/>
      <circle cx="28.5" cy="29" r="1.3" fill="currentColor" stroke="none"/>
      <line x1="23" y1="31" x2="23" y2="35"/>
      <path d="M18,38.5 Q23,41.5 28,38.5" />
    </svg>,
    // 4 fox
    <svg key={4} width="46" height="60" viewBox="0 0 46 60" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {cornerMarks}
      <path d="M11,20 L6,7 L18,17 Z" fill="currentColor" fillOpacity="0.22"/>
      <path d="M35,20 L40,7 L28,17 Z" fill="currentColor" fillOpacity="0.22"/>
      <circle cx="23" cy="30" r="14" fill="currentColor" fillOpacity="0.10"/>
      <path d="M17,37 L23,46 L29,37 Z" fill="currentColor" fillOpacity="0.2"/>
      <circle cx="23" cy="44" r="1.4" fill="currentColor" stroke="none"/>
      <path d="M14,27 L19,29" /><path d="M32,27 L27,29" />
    </svg>,
    // 5 owl
    <svg key={5} width="46" height="60" viewBox="0 0 46 60" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {cornerMarks}
      <path d="M13,17 L9,9 L17,15 Z" fill="currentColor" fillOpacity="0.22"/>
      <path d="M33,17 L37,9 L29,15 Z" fill="currentColor" fillOpacity="0.22"/>
      <circle cx="23" cy="31" r="14" fill="currentColor" fillOpacity="0.10"/>
      <circle cx="17" cy="30" r="5" fill="currentColor" fillOpacity="0.14"/>
      <circle cx="29" cy="30" r="5" fill="currentColor" fillOpacity="0.14"/>
      <circle cx="17" cy="30" r="1.4" fill="currentColor" stroke="none"/>
      <circle cx="29" cy="30" r="1.4" fill="currentColor" stroke="none"/>
      <path d="M21,36 L23,40 L25,36 Z" fill="currentColor" fillOpacity="0.3"/>
    </svg>,
    // 6 cat
    <svg key={6} width="46" height="60" viewBox="0 0 46 60" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {cornerMarks}
      <path d="M12,20 L9,8 L20,16 Z" fill="currentColor" fillOpacity="0.22"/>
      <path d="M34,20 L37,8 L26,16 Z" fill="currentColor" fillOpacity="0.22"/>
      <circle cx="23" cy="30" r="14" fill="currentColor" fillOpacity="0.10"/>
      <path d="M20,29 L18,27 M26,29 L28,27" />
      <path d="M22,35 L23,37 L24,35 Z" fill="currentColor" fillOpacity="0.3"/>
      <path d="M23,37 Q20,40 17,39 M23,37 Q26,40 29,39" strokeWidth="1.2"/>
      <line x1="6" y1="32" x2="15" y2="32"/><line x1="6" y1="36" x2="15" y2="35"/>
      <line x1="40" y1="32" x2="31" y2="32"/><line x1="40" y1="36" x2="31" y2="35"/>
    </svg>,
    // 7 bear
    <svg key={7} width="46" height="60" viewBox="0 0 46 60" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {cornerMarks}
      <circle cx="11" cy="14" r="5.5" fill="currentColor" fillOpacity="0.2"/>
      <circle cx="35" cy="14" r="5.5" fill="currentColor" fillOpacity="0.2"/>
      <circle cx="23" cy="31" r="14" fill="currentColor" fillOpacity="0.10"/>
      <circle cx="17.5" cy="29" r="1.3" fill="currentColor" stroke="none"/>
      <circle cx="28.5" cy="29" r="1.3" fill="currentColor" stroke="none"/>
      <ellipse cx="23" cy="38" rx="6.5" ry="5" fill="currentColor" fillOpacity="0.16"/>
      <circle cx="23" cy="36" r="1.4" fill="currentColor" stroke="none"/>
    </svg>,
  ];

  return (
    <button onClick={onSelect} style={{
      width:"76px", height:"90px", display:"flex", alignItems:"center", justifyContent:"center",
      border:`1px solid ${selected ? "#c9a227" : "rgba(201,162,39,0.22)"}`,
      backgroundColor: selected ? "rgba(201,162,39,0.10)" : "rgba(7,9,15,0.55)",
      cursor:"pointer", transition:"all 0.15s",
      color: selected ? "#c9a227" : "#6b5f42",
      boxShadow: selected ? "0 0 14px rgba(201,162,39,0.28)" : "none",
    }}
      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,162,39,0.45)"; }}
      onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,162,39,0.22)"; }}
    >
      {avatars[idx]}
    </button>
  );
}

function ProfileCreationScreen({ onSave }: { onSave: (p: PlayerProfile) => void }) {
  const [name, setName]       = useState("");
  const [avatarId, setAvatar] = useState(0);

  const badgeId = useMemo(() => {
    const n = name.trim();
    if (!n) return "??0000-DDI";
    const prefix = n.slice(0, 2).toUpperCase().padEnd(2, "X");
    const num = ((n.charCodeAt(0) * 31 + (n.charCodeAt(1) || 7)) % 9000) + 1000;
    return `${prefix}${num}-DDI`;
  }, [name]);

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const p: PlayerProfile = { name: name.trim(), avatarId, badgeId, rank: "RECRUIT DETECTIVE" };
    saveProfile(p);
    onSave(p);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-auto py-8"
      style={{ background:"radial-gradient(ellipse at center,#0f0c08 0%,#07090f 100%)" }}
    >
      <motion.div
        initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}
        style={{ width:"min(520px,94vw)", flexShrink:0 }}
      >
        {/* Header stamp */}
        <div style={{ transform:"rotate(-2.5deg)", textAlign:"center", marginBottom:"28px" }}>
          <div style={{ fontFamily:"Special Elite,serif", fontSize:"22px", color:"#c9a227", letterSpacing:"0.1em" }}>
            DETECTIVE PROFILE
          </div>
          <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"8px", color:"#b8a878",
            letterSpacing:"0.22em", marginTop:"5px" }}>
            PRECINCT 14 · DIVISION OF DIGITAL INVESTIGATIONS
          </div>
        </div>

        <div style={{ border:"1px solid rgba(201,162,39,0.30)", backgroundColor:"rgba(13,18,32,0.97)",
          padding:"28px 28px 32px" }}>

          {/* Name input */}
          <div style={{ marginBottom:"22px" }}>
            <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"8px", letterSpacing:"0.22em",
              color:"#b8a878", marginBottom:"8px" }}>
              DETECTIVE NAME
            </div>
            <input
              value={name} onChange={(e) => setName(e.target.value)} maxLength={28}
              placeholder="ENTER YOUR NAME"
              style={{
                width:"100%", boxSizing:"border-box",
                fontFamily:"Courier Prime,monospace", fontSize:"14px",
                color:"#ffd966", backgroundColor:"rgba(7,9,15,0.85)",
                border:"1px solid rgba(201,162,39,0.35)", padding:"10px 14px",
                letterSpacing:"0.08em", outline:"none",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#c9a227"; }}
              onBlur={(e)  => { e.target.style.borderColor = "rgba(201,162,39,0.35)"; }}
            />
          </div>

          {/* Avatar row */}
          <div style={{ marginBottom:"22px" }}>
            <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"8px", letterSpacing:"0.22em",
              color:"#b8a878", marginBottom:"10px" }}>
              SELECT AVATAR
            </div>
            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
              {[0,1,2,3,4,5,6,7].map(i => (
                <AvatarTile key={i} idx={i} selected={avatarId === i} onSelect={() => setAvatar(i)} />
              ))}
            </div>
          </div>

          {/* Auto-generated fields */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"26px" }}>
            {[
              { label:"DETECTIVE ID", value:badgeId,             color:"#00e9ff" },
              { label:"RANK",         value:"RECRUIT DETECTIVE", color:"#c9b882" },
            ].map(f => (
              <div key={f.label} style={{ border:"1px solid rgba(201,162,39,0.18)", padding:"10px 12px",
                backgroundColor:"rgba(7,9,15,0.5)" }}>
                <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"7px", color:"#6b5f42",
                  letterSpacing:"0.18em", marginBottom:"5px" }}>{f.label}</div>
                <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"11px", color:f.color,
                  letterSpacing:"0.06em" }}>{f.value}</div>
              </div>
            ))}
          </div>

          {/* Save button */}
          <button onClick={handleSave} disabled={!canSave} style={{
            width:"100%",
            fontFamily:"Special Elite,serif", fontSize:"14px", letterSpacing:"0.22em",
            color:       canSave ? "#07090f" : "#3a3428",
            backgroundColor: canSave ? "#c9a227" : "rgba(201,162,39,0.10)",
            border: `1px solid ${canSave ? "#c9a227" : "rgba(201,162,39,0.18)"}`,
            padding:"13px", cursor: canSave ? "pointer" : "not-allowed", transition:"all 0.2s",
          }}
            onMouseEnter={(e) => { if (canSave) (e.currentTarget as HTMLElement).style.boxShadow = "0 0 22px rgba(201,162,39,0.5)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >
            SAVE PROFILE &amp; ENTER HEADQUARTERS
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Player profile screen ────────────────────────────────────────────────────
function ProfileScreen({ profile, onBack }: { profile: PlayerProfile | null; onBack?: () => void }) {
  if (!profile) return null;
  return (
    <div className="flex flex-col h-full" style={{ background: "linear-gradient(135deg,#191008 0%,#140e06 100%)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle 1px at 17px 17px, rgba(201,162,39,0.05) 0, transparent 0)",
        backgroundSize: "17px 17px",
      }} />

      {/* Header */}
      <div className="relative flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(201,162,39,0.15)", backgroundColor: "rgba(7,9,15,0.65)" }}>
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} style={{
              fontFamily: "Special Elite, serif", fontSize: "22px", letterSpacing: "0.15em",
              color: "#c9a227", border: "1px solid rgba(201,162,39,0.4)", backgroundColor: "transparent",
              padding: "4px 12px", cursor: "pointer",
            }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.textShadow = "0 0 12px rgba(201,162,39,0.7)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.textShadow = "none"}
            >← BUREAU</button>
          )}
          <div>
            <div style={{ fontFamily: "Special Elite, serif", fontSize: "23px", color: "#ffd966", letterSpacing: "0.1em" }}>DETECTIVE PROFILE</div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#b8a878", letterSpacing: "0.2em", marginTop: "2px" }}>OFFICIAL SERVICE RECORD</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#c9a227", letterSpacing: "0.15em" }}>{profile.badgeId}</div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#6b5f42", letterSpacing: "0.15em", marginTop: "2px" }}>STATUS: ACTIVE</div>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: "thin" }}>
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          
          {/* Identity & Stats Row */}
          <div className="flex gap-6">
            {/* Identity Card */}
            <div className="flex-shrink-0 flex items-center gap-6" style={{ border: "1px solid rgba(201,162,39,0.2)", padding: "20px", backgroundColor: "rgba(7,9,15,0.75)" }}>
              <div style={{ width: "90px", height: "105px", border: "1px solid rgba(201,162,39,0.4)", backgroundColor: "rgba(201,162,39,0.1)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", color: "#c9a227" }}>
                <AvatarTile idx={profile.avatarId} selected={false} onSelect={() => {}} />
              </div>
              <div>
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#6b5f42", letterSpacing: "0.15em", marginBottom: "4px" }}>NAME</div>
                <div style={{ fontFamily: "Special Elite, serif", fontSize: "22px", color: "#ffd966", letterSpacing: "0.05em", marginBottom: "12px" }}>{profile.name}</div>
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#6b5f42", letterSpacing: "0.15em", marginBottom: "4px" }}>RANK</div>
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#c9b882", letterSpacing: "0.08em" }}>DETECTIVE II</div>
              </div>
            </div>

            {/* Main Stats */}
            <div className="flex-1 flex justify-between gap-4">
              {[
                { label: "TOTAL XP", value: "4,250", color: "#00e9ff" },
                { label: "COINS", value: "850", color: "#c9a227" },
                { label: "CASES CLOSED", value: "14", color: "#00ff6a" },
                { label: "AVG SCORE", value: "92%", color: "#ffd966" },
              ].map(stat => (
                <div key={stat.label} className="flex-1 flex flex-col justify-center items-center text-center" style={{ border: "1px solid rgba(201,162,39,0.2)", backgroundColor: "rgba(7,9,15,0.75)", padding: "16px" }}>
                  <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#6b5f42", letterSpacing: "0.15em", marginBottom: "8px" }}>{stat.label}</div>
                  <div style={{ fontFamily: "Special Elite, serif", fontSize: "26px", color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Promotion Progress */}
          <div style={{ border: "1px solid rgba(201,162,39,0.2)", backgroundColor: "rgba(7,9,15,0.75)", padding: "20px" }}>
            <div className="flex justify-between mb-3">
              <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#b8a878", letterSpacing: "0.15em" }}>PROMOTION PROGRESS</span>
              <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#c9a227", letterSpacing: "0.15em" }}>1,750 XP TO NEXT RANK</span>
            </div>
            <div style={{ width: "100%", height: "6px", backgroundColor: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.2)" }}>
              <div style={{ width: "70%", height: "100%", background: "linear-gradient(to right, #c9a227, #ffd966)" }} />
            </div>
          </div>

          {/* Achievements Grid */}
          <div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#ffd966", letterSpacing: "0.2em", borderBottom: "1px solid rgba(201,162,39,0.2)", paddingBottom: "8px", marginBottom: "16px" }}>SERVICE AWARDS & SKILLS</div>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { title: "SHARP EYE", desc: "Found 10 critical clues without hints.", color: "#00e9ff" },
                { title: "FLAWLESS LOGIC", desc: "Submitted a 100% correct Evidence Wall.", color: "#00ff6a" },
                { title: "NIGHT OWL", desc: "Completed 5 cases during the night shift.", color: "#c9a227" },
                { title: "INTERROGATOR", desc: "Caught 3 suspects in a lie.", color: "#e74c3c" },
              ].map(ach => (
                <div key={ach.title} style={{ border: "1px solid rgba(201,162,39,0.15)", backgroundColor: "rgba(7,9,15,0.6)", padding: "16px", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, width: "3px", height: "100%", backgroundColor: ach.color }} />
                  <div style={{ fontFamily: "Special Elite, serif", fontSize: "20px", color: "#c9b882", marginBottom: "6px" }}>{ach.title}</div>
                  <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#6b5f42", lineHeight: 1.5 }}>{ach.desc}</div>
                </div>
              ))}
            </div>

            {/* Skill Cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: "SOURCE SCANNER MASTERY", desc: "Successfully validated 50 individual sources.", active: true },
                { title: "TIMELINE LENS EXPERT", desc: "Reconstructed 10 chronological anomalies.", active: false },
              ].map(skill => (
                <div key={skill.title} style={{
                  border: `1px solid ${skill.active ? "rgba(201,162,39,0.3)" : "rgba(201,162,39,0.1)"}`,
                  borderLeft: `4px solid ${skill.active ? "#c9a227" : "rgba(201,162,39,0.2)"}`,
                  backgroundColor: skill.active ? "rgba(201,162,39,0.05)" : "rgba(7,9,15,0.4)",
                  padding: "16px 20px",
                  opacity: skill.active ? 1 : 0.5,
                }}>
                  <div style={{ fontFamily: "Special Elite, serif", fontSize: "20px", color: skill.active ? "#ffd966" : "#c9b882", letterSpacing: "0.05em", marginBottom: "6px" }}>
                    {skill.title}
                  </div>
                  <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#b8a878", lineHeight: 1.6 }}>
                    {skill.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Main menu screen ─────────────────────────────────────────────────────────
// Cork BG decoration items (behind menu, non-interactive)
const BG_PINS = [
  { label: "DOCK 7 — PHOTO", x: 6,  y: 18, rot: -4 },
  { label: "CLIPPING — HERALD", x: 72, y: 12, rot: 3 },
  { label: "FINGERPRINT CARD", x: 18, y: 60, rot: 2 },
  { label: "CODED MESSAGE",    x: 78, y: 62, rot: -3 },
  { label: "CASE FILE 2024",   x: 48, y: 78, rot: 5 },
];
const BG_STRINGS = [[0,1],[1,3],[0,2],[2,4]];

function MainMenuScreen({ onNavigate, cases, reduceMotion, settings, profile }: {
  onNavigate: (s: Screen) => void;
  cases: CaseRecord[];
  reduceMotion?: boolean;
  settings?: SettingsState;
  profile?: PlayerProfile | null;
}) {
  const [hovered, setHovered]         = useState<number | null>(null);
  const [clock, setClock]             = useState("02:47:33");
  const [hovScan, setHovScan]         = useState<number | null>(null);
  const [showFlicker, setShowFlicker] = useState(false);
  const [stringVisible, setStringVisible] = useState(false);
  const [pressedIdx, setPressedIdx]   = useState<number | null>(null);

  // Audio refs
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const ambientGainRef = useRef<GainNode | null>(null);
  const ambientSrcRef  = useRef<AudioBufferSourceNode | null>(null);
  const sfxLockRef     = useRef(false);
  const ambientStarted = useRef(false);

  const getCtx = useCallback((): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch { return null; }
  }, []);

  const startAmbient = useCallback(() => {
    if (!settings?.ambientSound || ambientStarted.current) return;
    ambientStarted.current = true;
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const sr = ctx.sampleRate;
      const bufLen = sr * 3;
      const buf = ctx.createBuffer(1, bufLen, sr);
      const data = buf.getChannelData(0);
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for (let i = 0; i < bufLen; i++) {
        const w = Math.random() * 2 - 1;
        b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
        b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
        b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
        data[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.004;
        b6=w*0.115926;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain); gain.connect(ctx.destination);
      src.start();
      gain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 1.5);
      ambientSrcRef.current = src;
      ambientGainRef.current = gain;
    } catch {}
  }, [settings?.ambientSound, getCtx]);

  const stopAmbient = useCallback(() => {
    if (!ambientGainRef.current || !audioCtxRef.current) return;
    try {
      ambientGainRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.7);
      const src = ambientSrcRef.current;
      setTimeout(() => { try { src?.stop(); } catch {} ambientSrcRef.current = null; ambientGainRef.current = null; ambientStarted.current = false; }, 800);
    } catch {}
  }, []);

  const playClack = useCallback(() => {
    if (!settings?.typewriterSfx || sfxLockRef.current) return;
    sfxLockRef.current = true;
    setTimeout(() => { sfxLockRef.current = false; }, 80);
    try {
      const ctx = getCtx(); if (!ctx) return;
      const sr = ctx.sampleRate; const dur = 0.042;
      const buf = ctx.createBuffer(1, sr * dur, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) { const t = i/sr; data[i]=(Math.random()*2-1)*Math.exp(-t*95)*0.5; }
      const bpf = ctx.createBiquadFilter(); bpf.type="bandpass"; bpf.frequency.value=2100; bpf.Q.value=1.2;
      const gain = ctx.createGain(); gain.gain.value = 0.17;
      const src = ctx.createBufferSource(); src.buffer=buf;
      src.connect(bpf); bpf.connect(gain); gain.connect(ctx.destination); src.start();
    } catch {}
  }, [settings?.typewriterSfx, getCtx]);

  const playThunk = useCallback(() => {
    if (!settings?.typewriterSfx) return;
    try {
      const ctx = getCtx(); if (!ctx) return;
      const sr = ctx.sampleRate; const dur = 0.078;
      const buf = ctx.createBuffer(1, sr * dur, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) { const t = i/sr; data[i]=(Math.random()*2-1)*Math.exp(-t*38)*0.68; }
      const lpf = ctx.createBiquadFilter(); lpf.type="lowpass"; lpf.frequency.value=680;
      const gain = ctx.createGain(); gain.gain.value = 0.21;
      const src = ctx.createBufferSource(); src.buffer=buf;
      src.connect(lpf); lpf.connect(gain); gain.connect(ctx.destination); src.start();
    } catch {}
  }, [settings?.typewriterSfx, getCtx]);

  const playRustle = useCallback(() => {
    if (!settings?.typewriterSfx) return;
    try {
      const ctx = getCtx(); if (!ctx) return;
      const sr = ctx.sampleRate; const dur = 0.14;
      const buf = ctx.createBuffer(1, sr * dur, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) { const t = i/sr; data[i]=(Math.random()*2-1)*Math.sin(Math.PI*t/dur)*0.32; }
      const bpf = ctx.createBiquadFilter(); bpf.type="bandpass"; bpf.frequency.value=3800; bpf.Q.value=0.6;
      const gain = ctx.createGain(); gain.gain.value = 0.14;
      const src = ctx.createBufferSource(); src.buffer=buf;
      src.connect(bpf); bpf.connect(gain); gain.connect(ctx.destination); src.start();
    } catch {}
  }, [settings?.typewriterSfx, getCtx]);

  useEffect(() => {
    return () => stopAmbient();
  }, [stopAmbient]);

  useEffect(() => {
    let secs = 2 * 3600 + 47 * 60 + 33;
    const t = setInterval(() => {
      secs++;
      const h = String(Math.floor(secs / 3600)).padStart(2, "0");
      const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
      const s = String(secs % 60).padStart(2, "0");
      setClock(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const t = setTimeout(() => {
      setStringVisible(true);
      playRustle();
    }, 900);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = 20000 + Math.random() * 10000;
      timer = setTimeout(() => {
        setShowFlicker(true);
        setTimeout(() => { setShowFlicker(false); schedule(); }, 80);
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  const handleTileEnter = (i: number, disabled: boolean) => {
    if (disabled) return;
    setHovered(i);
    startAmbient();
    playClack();
    if (reduceMotion) return;
    setHovScan(i);
    setTimeout(() => setHovScan(prev => prev === i ? null : prev), 640);
  };

  const activeCase = cases.find(c => c.status === "in-progress") ?? null;
  const statusColor = (s: CaseStatus) =>
    s === "in-progress" ? "#00e9ff" : s === "closed-solved" ? "#00ff6a" : s === "closed-cold" ? "#e74c3c" : "rgba(201,162,39,0.3)";
  const statusLabel = (s: CaseStatus) =>
    s === "available" ? "AVAILABLE" : s === "in-progress" ? "ACTIVE" : s === "closed-solved" ? "SOLVED" : s === "closed-cold" ? "COLD" : "LOCKED";

  const solvedCount = cases.filter(c => c.status === "closed-solved").length;
  const xp = solvedCount * 1200 + cases.filter(c => c.status === "closed-cold").length * 200;
  const rank = solvedCount >= 5 ? "LEAD DETECTIVE" : solvedCount >= 3 ? "SENIOR DET." : solvedCount >= 1 ? "JUNIOR DET." : "TRAINEE";

  const hubItems = [
    { label: "MISSION BOARD",     color: "#ffd966", isPrimary: true,
      sub: activeCase
        ? `ACTIVE · ${CASES_CATALOG.find(c => c.caseId === activeCase.caseId)?.title ?? activeCase.caseId}`
        : "SELECT FROM OPEN CASE FILES",
      onClick: () => onNavigate("case-select"),  disabled: false, showDot: !!activeCase },
    { label: "NOTEBOOK",          color: "#b8a878", isPrimary: false, sub: "CASE ARCHIVE · YOUR NOTES",
      onClick: () => onNavigate("notebook"),     disabled: false, showDot: false },
    { label: "DETECTIVE RECORDS", color: "#b8a878", isPrimary: false, sub: "COMPLETED CASES · ACHIEVEMENTS",
      onClick: () => onNavigate("records"),      disabled: false, showDot: false },
    { label: "EVIDENCE WALL",     color: "#b8a878", isPrimary: false, sub: "CASE CONNECTIONS · THEORY BOARD",
      onClick: () => onNavigate("evidence-wall"), disabled: false, showDot: false },
    { label: "PROFILE",           color: "#b8a878", isPrimary: false, sub: "DETECTIVE RECORD · ACHIEVEMENTS",
      onClick: () => onNavigate("profile"),      disabled: false, showDot: false },
    { label: "SETTINGS",          color: "#b8a878", isPrimary: false, sub: "AUDIO · DISPLAY · CONTROLS",
      onClick: () => onNavigate("settings"),     disabled: false, showDot: false },
  ];

  return (
    <div className={`absolute inset-0 flex flex-col ${reduceMotion ? "" : "scene-drift"}`} style={{ background: "linear-gradient(135deg,#191008 0%,#140e06 100%)" }}>
      <MenuAnimatedBg reduceMotion={reduceMotion} />

      {/* Cork grain */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle 1px at 17px 17px, rgba(201,162,39,0.05) 0, transparent 0)",
        backgroundSize: "17px 17px",
      }} />

      {/* BG strings SVG — foreground decorative (separate from MenuAnimatedBg strings) */}
      <svg className={`absolute inset-0 w-full h-full pointer-events-none ${reduceMotion ? "" : "mbg-string-pulse"}`} style={{ opacity: 0.13 }}>
        {BG_STRINGS.map(([a, b], i) => (
          <line key={i}
            x1={`${BG_PINS[a].x + 4}%`} y1={`${BG_PINS[a].y + 2}%`}
            x2={`${BG_PINS[b].x + 4}%`} y2={`${BG_PINS[b].y + 2}%`}
            stroke="rgba(200,20,20,1)" strokeWidth="1.2"
          />
        ))}
      </svg>

      {/* BG pinned cards */}
      {BG_PINS.map((p, i) => (
        <div key={i} className={`absolute pointer-events-none ${reduceMotion ? "" : "mbg-pin-sway"}`} style={{
          left: `${p.x}%`, top: `${p.y}%`,
          opacity: i < 2 ? 0.17 : 0.10,
          filter: "blur(0.8px)",
          "--f-rot": `${p.rot}deg`,
          animationDelay: `${i * 2.5}s`,
        } as React.CSSProperties}>
          <div style={{ position: "relative", backgroundColor: "#e2cfae", padding: "5px 9px", width: "80px", boxShadow: "2px 3px 8px rgba(0,0,0,0.6)" }}>
            <div style={{ position: "absolute", top: "-6px", left: "50%", transform: "translateX(-50%)", width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#c9a227" }} />
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#1a1005" }}>{p.label}</div>
          </div>
        </div>
      ))}

      {/* Content scrim — glow re-centered above NEW CASE tile area */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 55% 70% at 50% 52%, rgba(7,9,15,0.38) 0%, rgba(7,9,15,0.65) 100%)" }} />

      {/* Rare fluorescent flicker */}
      {showFlicker && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 6, backgroundColor: "rgba(7,9,15,0.03)" }} />
      )}

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid rgba(201,162,39,0.15)", backgroundColor: "rgba(7,9,15,0.55)" }}>
        {/* Title + stamp chip */}
        <div className="flex items-start gap-3">
          <div style={{ transform: "rotate(-3deg)" }}>
            <div style={{
              fontFamily: "Special Elite, serif", fontSize: "22px", color: "#ffd966",
              letterSpacing: "0.1em", lineHeight: 1,
              animation: reduceMotion
                ? "amber-glow 2.4s ease-in-out infinite"
                : "amber-glow 2.4s ease-in-out infinite, title-breathe 4s ease-in-out infinite",
            }}>DIGITAL DETECTIVE</div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#b8a878", letterSpacing: "0.22em" }}>
              PRECINCT 14 · DIVISION OF DIGITAL INVESTIGATIONS
            </div>
          </div>
        </div>
        {/* Status right */}
        <div style={{ textAlign: "right" }}>
          <div className="cyan-flicker" style={{
            fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#00e9ff",
            letterSpacing: "0.15em", animationDuration: reduceMotion ? "0s" : "10s",
          }}>● SYSTEM ONLINE</div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#b8a878", letterSpacing: "0.12em", marginTop: "2px" }}>{clock} · PRECINCT 14</div>
        </div>
      </div>

      {/* Stat row — rank / XP / coins */}
      <div className="relative flex items-center gap-8 px-6 py-2" style={{ borderBottom: "1px solid rgba(201,162,39,0.1)", backgroundColor: "rgba(7,9,15,0.5)", flexShrink: 0 }}>
        {profile && (
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#c9a227", letterSpacing: "0.14em" }}>
            {profile.name} · {profile.badgeId}
          </div>
        )}
        <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(201,162,39,0.08)" }} />
        {[
          { label: "RANK", value: rank },
          { label: "XP", value: xp.toLocaleString() },
          { label: "CASES CLOSED", value: `${solvedCount}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(201,162,39,0.35)", letterSpacing: "0.18em", marginBottom: "2px" }}>{label}</div>
            <div style={{ fontFamily: "Special Elite, serif", fontSize: "20px", color: "#c9b882", letterSpacing: "0.08em" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Center layout */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left column */}
        <div className="flex-shrink-0 flex flex-col justify-between py-6 px-5" style={{ width: "200px", borderRight: "1px solid rgba(201,162,39,0.1)", backgroundColor: "rgba(7,9,15,0.55)" }}>
          <div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", letterSpacing: "0.2em", color: "rgba(201,162,39,0.4)", marginBottom: "10px" }}>ACTIVE DOSSIER</div>
            {activeCase ? (
              <div style={{ border: "1px solid rgba(201,162,39,0.25)", padding: "12px" }}>
                <div style={{ fontFamily: "Special Elite, serif", fontSize: "22px", color: "#ffd966", letterSpacing: "0.07em" }}>{activeCase.caseId}</div>
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#b8a878", marginTop: "3px" }}>
                  {CASES_CATALOG.find(c => c.caseId === activeCase.caseId)?.title}
                </div>
                <div style={{ height: "1px", backgroundColor: "rgba(201,162,39,0.15)", margin: "8px 0" }} />
                {[
                  { k: "STATUS", v: "ACTIVE" },
                  { k: "TIME LEFT", v: `${Math.floor(activeCase.timeRemainingSec / 60)}m ${activeCase.timeRemainingSec % 60}s` },
                  { k: "VERDICTS", v: `${activeCase.verdictsGiven.length}` },
                ].map((r) => (
                  <div key={r.k} className="flex justify-between" style={{ marginBottom: "4px" }}>
                    <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "rgba(201,162,39,0.45)", letterSpacing: "0.1em" }}>{r.k}</span>
                    <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#c9b882" }}>{r.v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ border: "1px solid rgba(201,162,39,0.12)", padding: "12px" }}>
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "rgba(201,162,39,0.3)", letterSpacing: "0.1em" }}>NO ACTIVE CASE</div>
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "rgba(201,162,39,0.2)", marginTop: "4px" }}>SELECT NEW CASE TO BEGIN</div>
              </div>
            )}
          </div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", letterSpacing: "0.15em", color: "rgba(201,162,39,0.25)", lineHeight: 1.8 }}>
            DETECTIVE: R. CHEN<br />BADGE: 7741-DDI<br />CLEARANCE: LEVEL 4
          </div>
        </div>

        {/* Menu column */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ position: "relative" }}>
          {/* One-time red string draw */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0, overflow: "visible" }}>
            {!reduceMotion && (
              <line x1="52%" y1="36%" x2="26%" y2="46%"
                stroke="rgba(200,20,20,0.5)" strokeWidth="1.1" strokeLinecap="round"
                strokeDasharray="220" strokeDashoffset={stringVisible ? 0 : 220}
                style={{ transition: stringVisible ? "stroke-dashoffset 0.95s ease-out" : "none" }}
              />
            )}
          </svg>

          {/* SELECT OPERATION divider with flanking lines + cursor */}
          <div className="flex items-center gap-3" style={{ marginBottom: "4px", position: "relative", zIndex: 1, width: "380px" }}>
            <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(201,162,39,0.2)" }} />
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", letterSpacing: "0.28em", color: "rgba(201,162,39,0.3)" }}>
              SELECT OPERATION
            </div>
            <span className={reduceMotion ? "" : "op-cursor-blink"} style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(0,233,255,0.45)" }}>_</span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(201,162,39,0.2)" }} />
          </div>

          {hubItems.map((item, i) => {
            const isHov  = hovered === i && !item.disabled;
            const hasScan = hovScan === i;
            const isNewCase = item.label === "MISSION BOARD";
            const isPressed = pressedIdx === i;
            return (
              <motion.button
                key={item.label}
                onClick={() => { if (!item.disabled) { playThunk(); item.onClick(); } }}
                onMouseEnter={() => handleTileEnter(i, item.disabled)}
                onMouseLeave={() => { setHovered(null); setPressedIdx(null); }}
                onMouseDown={() => { if (!item.disabled) setPressedIdx(i); }}
                onMouseUp={() => setPressedIdx(null)}
                disabled={item.disabled}
                initial={reduceMotion ? false : { opacity: 0, y: 12, rotate: i % 2 === 0 ? 1.8 : -1.8 }}
                animate={{
                  opacity: item.disabled ? 0.45 : 1, y: 0, rotate: 0,
                  scale: isPressed && !item.disabled ? 0.97 : 1,
                  filter: isPressed && !item.disabled ? "brightness(1.18)" : "brightness(1)",
                }}
                transition={{ duration: isPressed ? 0.06 : 0.45, delay: isPressed ? 0 : i * 0.12, ease: "easeOut" }}
                className={isNewCase && !reduceMotion ? "tile-amber-box-glow" : ""}
                style={{
                  width: "380px",
                  border: `1px solid ${isHov ? item.color : item.isPrimary && !item.disabled ? "rgba(201,162,39,0.35)" : "rgba(201,162,39,0.14)"}`,
                  backgroundColor: isHov ? "rgba(201,162,39,0.07)" : "rgba(7,9,15,0.6)",
                  padding: "14px 22px",
                  cursor: item.disabled ? "not-allowed" : "pointer",
                  textAlign: "left",
                  transition: "border-color 0.16s, background-color 0.16s",
                  boxShadow: isNewCase
                    ? undefined
                    : `0 4px 12px rgba(0,0,0,0.5)${isHov ? ", 0 0 14px rgba(201,162,39,0.10)" : ""}, inset 0 1px 0 rgba(255,217,102,0.06)`,
                  position: "relative", overflow: "hidden", zIndex: 1,
                }}
              >
                {/* Left accent flicker on hover */}
                <div className={isHov && !reduceMotion ? "tile-border-flicker" : ""}
                  style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "2px", backgroundColor: item.color, opacity: isHov ? 1 : 0, transition: "opacity 0.16s" }}
                />
                {/* Scanline sweep */}
                {hasScan && (
                  <div className="tile-scan-active" style={{
                    position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
                    background: "repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.14) 3px, rgba(0,0,0,0.14) 4px)",
                  }} />
                )}
                <div style={{
                  fontFamily: "Special Elite, serif", fontSize: item.isPrimary ? "20px" : "16px",
                  letterSpacing: "0.18em", color: item.color, lineHeight: 1,
                  textShadow: isHov ? `0 0 14px ${item.color}70` : "none",
                  transition: "text-shadow 0.16s",
                  display: "flex", alignItems: "center", gap: "9px",
                }}>
                  {item.showDot && (
                    <div className="dot-pulse" style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#e74c3c", flexShrink: 0 }} />
                  )}
                  {item.label}
                </div>
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", letterSpacing: "0.14em", color: isHov ? "#b8a878" : "rgba(184,168,120,0.4)", marginTop: "5px", transition: "color 0.16s" }}>
                  {item.sub}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="flex-shrink-0 flex flex-col justify-between py-6 px-5" style={{ width: "200px", borderLeft: "1px solid rgba(201,162,39,0.1)", backgroundColor: "rgba(7,9,15,0.55)" }}>
          <div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", letterSpacing: "0.2em", color: "rgba(201,162,39,0.4)", marginBottom: "10px" }}>CASE FILES</div>
            {cases.slice(0, 3).map((c) => {
              const meta = CASES_CATALOG.find(m => m.caseId === c.caseId)!;
              return (
                <div key={c.caseId} style={{ borderBottom: "1px solid rgba(201,162,39,0.08)", paddingBottom: "8px", marginBottom: "8px" }}>
                  <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: statusColor(c.status), letterSpacing: "0.08em" }}>{c.caseId}</div>
                  <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#b8a878", marginTop: "1px" }}>
                    {c.status === "locked" ? "CLASSIFIED" : meta.title}
                  </div>
                  <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", letterSpacing: "0.15em", color: statusColor(c.status), opacity: 0.8, marginTop: "2px" }}>
                    {statusLabel(c.status)}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", letterSpacing: "0.12em", color: "rgba(201,162,39,0.22)", lineHeight: 1.8 }}>
            CASE ENGINE REV 14<br />BUILD 2024-07-12<br />© PRECINCT 14 DDI
          </div>
        </div>
      </div>

      {/* Bottom bar — dot-pulse only when active */}
      <div className="relative flex items-center gap-6 px-6 py-2" style={{ borderTop: "1px solid rgba(201,162,39,0.12)", backgroundColor: "rgba(7,9,15,0.55)" }}>
        <div className="flex items-center gap-2">
          <div className={activeCase ? "dot-pulse" : ""} style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: activeCase ? "#e74c3c" : "#3a3428" }} />
          <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#b8a878", letterSpacing: "0.14em" }}>
            {activeCase ? "1 ACTIVE INVESTIGATION" : "NO ACTIVE INVESTIGATION"}
          </span>
        </div>
        <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(184,168,120,0.35)", letterSpacing: "0.12em" }}>SECURE CHANNEL · AES-256</span>
      </div>
    </div>
  );
}

// ─── Case select screen ───────────────────────────────────────────────────────
function CaseSelectScreen({
  cases, onSelect, onBrief, onBack,
}: {
  cases: CaseRecord[];
  onSelect: (caseId: string, resume: boolean) => void;
  onBrief: (caseId: string) => void;
  onBack: () => void;
}) {
  const [shakingId, setShakingId] = useState<string | null>(null);

  const handleCardClick = (c: CaseRecord) => {
    if (c.status === "locked") {
      setShakingId(c.caseId);
      setTimeout(() => setShakingId(null), 400);
      return;
    }
    if (c.status === "in-progress") { onSelect(c.caseId, true); return; }
    if (c.status === "available")   { onBrief(c.caseId); return; }
    onSelect(c.caseId, true);
  };

  const statusColor = (s: CaseStatus) =>
    s === "in-progress" ? "#00e9ff" : s === "closed-solved" ? "#00ff6a" : s === "closed-cold" ? "#e74c3c" : s === "available" ? "#c9a227" : "#3a3428";
  const statusLabel = (s: CaseStatus) =>
    s === "available" ? "AVAILABLE" : s === "in-progress" ? "IN PROGRESS" : s === "closed-solved" ? "CLOSED · SOLVED" : s === "closed-cold" ? "CLOSED · COLD" : "LOCKED";

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "linear-gradient(135deg,#191008 0%,#140e06 100%)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle 1px at 17px 17px, rgba(201,162,39,0.05) 0, transparent 0)",
        backgroundSize: "17px 17px",
      }} />

      {/* Header */}
      <div className="relative flex items-center gap-4 px-5 py-3" style={{ borderBottom: "1px solid rgba(201,162,39,0.18)", backgroundColor: "rgba(7,9,15,0.65)" }}>
        <button onClick={onBack} style={{
          fontFamily: "Special Elite, serif", fontSize: "20px", letterSpacing: "0.15em",
          color: "#c9a227", border: "1px solid rgba(201,162,39,0.4)", backgroundColor: "transparent",
          padding: "5px 14px", cursor: "pointer",
        }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.textShadow = "0 0 12px rgba(201,162,39,0.7)"}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.textShadow = "none"}
        >← BUREAU</button>
        <div>
          <div style={{ fontFamily: "Special Elite, serif", fontSize: "20px", color: "#ffd966", letterSpacing: "0.08em" }}>SELECT CASE FILE</div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#b8a878", letterSpacing: "0.18em" }}>OPEN A NEW INVESTIGATION OR REVIEW CLOSED FILES</div>
        </div>
      </div>

      {/* Grid */}
      <div className="relative flex-1 overflow-y-auto p-8 flex flex-wrap gap-5 content-start justify-center" style={{ scrollbarWidth: "thin" }}>
        {cases.map((c, idx) => {
          const meta = CASES_CATALOG.find(m => m.caseId === c.caseId)!;
          const locked = c.status === "locked";
          const rot = ((idx * 5 + 2) % 7) - 3;
          return (
            <div
              key={c.caseId}
              className={shakingId === c.caseId ? "card-shake" : ""}
              style={{ "--rot": `${rot}deg` } as React.CSSProperties}
              onClick={() => handleCardClick(c)}
            >
              <div style={{
                width: "200px",
                backgroundColor: locked ? "#0d0e14" : "#e2cfae",
                padding: "14px 12px 18px",
                transform: `rotate(${rot}deg)`,
                boxShadow: locked ? "2px 4px 14px rgba(0,0,0,0.7)" : "3px 5px 16px rgba(0,0,0,0.65)",
                cursor: locked ? "not-allowed" : "pointer",
                position: "relative",
                border: locked ? "1px solid rgba(201,162,39,0.12)" : "none",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
                onMouseEnter={(e) => { if (!locked) { (e.currentTarget as HTMLElement).style.transform = `rotate(0deg) scale(1.04)`; (e.currentTarget as HTMLElement).style.boxShadow = "4px 6px 22px rgba(0,0,0,0.8)"; } }}
                onMouseLeave={(e) => { if (!locked) { (e.currentTarget as HTMLElement).style.transform = `rotate(${rot}deg) scale(1)`; (e.currentTarget as HTMLElement).style.boxShadow = "3px 5px 16px rgba(0,0,0,0.65)"; } }}
              >
                {/* Pin */}
                <div style={{ position: "absolute", top: "-7px", left: "50%", transform: "translateX(-50%)", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: statusColor(c.status), boxShadow: `0 0 5px ${statusColor(c.status)}80` }} />

                {/* Locked CLASSIFIED overlay */}
                {locked && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(7,9,15,0.0)" }}>
                    <div style={{ transform: "rotate(-20deg)", fontFamily: "Special Elite, serif", fontSize: "20px", color: "#e74c3c", border: "2px solid #e74c3c", padding: "4px 10px", opacity: 0.55, letterSpacing: "0.2em" }}>
                      CLASSIFIED
                    </div>
                  </div>
                )}

                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: locked ? "rgba(201,162,39,0.3)" : "#5a3a1a", letterSpacing: "0.1em", marginBottom: "4px" }}>
                  {c.caseId}
                </div>
                <div style={{ fontFamily: "Special Elite, serif", fontSize: locked ? "12px" : "13px", color: locked ? "rgba(201,162,39,0.2)" : "#1a1005", letterSpacing: "0.05em", lineHeight: 1.3, marginBottom: "6px" }}>
                  {locked ? "CLASSIFIED" : meta.title}
                </div>
                {!locked && meta.teaser && (
                  <div style={{ fontFamily: "Caveat, cursive", fontSize: "20px", color: "#5a3a1a", lineHeight: 1.5, marginBottom: "8px" }}>
                    {meta.teaser}
                  </div>
                )}
                {locked && (
                  <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "rgba(201,162,39,0.2)", lineHeight: 1.5 }}>
                    SOLVE PRIOR CASE<br />TO UNLOCK
                  </div>
                )}
                <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: statusColor(c.status), flexShrink: 0 }} />
                  <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: locked ? "rgba(201,162,39,0.25)" : "#5a3a1a", letterSpacing: "0.1em" }}>
                    {statusLabel(c.status)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ─── Speaker block — reusable labeled dialogue component ─────────────────────
// ─── Mission briefing screen ──────────────────────────────────────────────────
function MissionBriefingScreen({
  caseId, onAccept, onBack,
}: {
  caseId: string;
  onAccept: () => void;
  onBack: () => void;
}) {
  const meta = CASES_CATALOG.find(m => m.caseId === caseId)!;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-auto py-8"
      style={{ background: "radial-gradient(ellipse at center, #0f0c08 0%, #07090f 100%)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ width: "min(580px, 93vw)", flexShrink: 0 }}
      >
        {/* Red-flagged notification strip */}
        <div style={{
          backgroundColor: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.45)",
          borderBottom: "none",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="dot-pulse" style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#ef4444", flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", letterSpacing: "0.26em", color: "#ef4444" }}>PRIORITY · HIGH</div>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", letterSpacing: "0.12em", color: "#c9b882", marginTop: "2px" }}>
                CLASSIFICATION: ACTIVE INVESTIGATION · REACH: NATIONAL
              </div>
            </div>
          </div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", letterSpacing: "0.14em", color: "rgba(201,162,39,0.55)", flexShrink: 0 }}>
            CASE {caseId}
          </div>
        </div>

        {/* Case-document panel — same cream paper as recruitment letter */}
        <div style={{
          background: "linear-gradient(170deg,#ead7b4 0%,#d9c49c 100%)",
          padding: "clamp(22px,4vw,44px) clamp(20px,5vw,44px)",
          position: "relative",
          boxShadow: "0 32px 100px rgba(0,0,0,0.92), 0 0 0 1px rgba(201,162,39,0.26)",
        }}>
          {/* Bottom paper edge */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"4px", background:"linear-gradient(to right,#a87c48,#c0a86c,#9e6f38,#c0a86c,#a87c48)" }} />

          {/* Classification header */}
          <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"7px", letterSpacing:"0.3em", color:"#5a3a1a", textAlign:"center", marginBottom:"18px", opacity:0.6 }}>
            BUREAU OF DIGITAL INVESTIGATIONS · PRECINCT 14 · CONFIDENTIAL
          </div>

          {/* Case title stamp */}
          <div style={{ display:"inline-block", transform:"rotate(-2deg)", marginBottom:"18px", borderBottom:"2px solid rgba(90,58,26,0.28)", paddingBottom:"10px" }}>
            <div style={{ fontFamily:"Special Elite,serif", fontSize:"9px", color:"#5a3a1a", letterSpacing:"0.2em", marginBottom:"4px", opacity:0.7 }}>MISSION BRIEFING</div>
            <div style={{ fontFamily:"Special Elite,serif", fontSize:"20px", color:"#1a1005", letterSpacing:"0.07em", lineHeight:1.2 }}>{meta.title}</div>
            <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"7px", color:"#5a3a1a", letterSpacing:"0.18em", marginTop:"4px", opacity:0.65 }}>REF: {caseId}</div>
          </div>

          {/* Case teaser */}
          <div style={{ border:"1px solid rgba(90,58,26,0.18)", backgroundColor:"rgba(90,58,26,0.03)", padding:"12px 14px" }}>
            <div style={{ fontFamily:"Courier Prime,monospace", fontSize:"10px", color:"#2a1a0a", lineHeight:1.9 }}>
              {meta.teaser ?? "Details classified until formal assignment."}
            </div>
          </div>
        </div>

        {/* Commander Mira briefing — outside parchment, on dark bg */}
        <div style={{ padding:"18px 4px 0" }}>
          <MiraPopup message={MIRA_MISSION_INTRO} />
        </div>

        {/* Action row */}
        <div style={{ display:"flex", gap:"12px", alignItems:"center", justifyContent:"space-between", padding:"18px 4px 0" }}>
          <button onClick={onBack} style={{
            fontFamily:"Courier Prime,monospace", fontSize:"8.5px", letterSpacing:"0.16em",
            color:"rgba(201,162,39,0.45)", backgroundColor:"transparent",
            border:"1px solid rgba(201,162,39,0.22)", padding:"8px 18px", cursor:"pointer",
          }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = "rgba(201,162,39,0.8)"}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = "rgba(201,162,39,0.45)"}
          >← DECLINE</button>

          <button onClick={onAccept} style={{
            fontFamily:"Special Elite,serif", fontSize:"14px", letterSpacing:"0.22em",
            color:"#07090f",
            border:"2px solid rgba(201,162,39,0.7)",
            backgroundColor:"rgba(201,162,39,0.88)",
            padding:"11px 32px", cursor:"pointer", transition:"all 0.18s",
          }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = "#c9a227"}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(201,162,39,0.88)"}
          >ACCEPT MISSION</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Case resolution screen ───────────────────────────────────────────────────

// Per-element contribution to each scoring dimension (raw points)
const EL_SCORES: Record<string, { obs: number; ev: number; src: number; ver: number }> = {
  "headline":        { obs: 30, ev:  8, src:  4, ver:  5 },
  "handle":          { obs: 22, ev: 12, src: 35, ver: 28 },
  "claim-medicines": { obs: 14, ev: 32, src:  8, ver: 20 },
  "claim-effects":   { obs: 10, ev: 26, src:  6, ver: 15 },
  "claim-everyone":  { obs:  8, ev: 18, src:  5, ver:  8 },
  "claim-thousands": { obs:  6, ev: 10, src:  4, ver:  5 },
  "cta":             { obs: 18, ev:  6, src:  3, ver:  6 },
  "engagement":      { obs:  6, ev:  2, src:  2, ver:  2 },
  "comment":         { obs:  8, ev:  4, src:  3, ver:  3 },
};
// Caps calibrated so 2–3 key elements already reach or approach 100%
const EL_CAPS = { obs: 62, ev: 60, src: 60, ver: 50 };

function computeScores(investigated: string[], notes: string): { label: string; score: number }[] {
  const toScore = (val: number, cap: number) => Math.round(42 + Math.min(val, cap) / cap * 53);
  const sum = (key: keyof typeof EL_CAPS) =>
    investigated.reduce((a, id) => a + (EL_SCORES[id]?.[key] ?? 0), 0);

  const obs  = toScore(sum("obs"), EL_CAPS.obs);
  const ev   = toScore(sum("ev"),  EL_CAPS.ev);
  const src  = toScore(sum("src"), EL_CAPS.src);
  const ver  = toScore(sum("ver"), EL_CAPS.ver);
  const noteLen = notes.trim().length;
  const rsn  = Math.round(42 + Math.min(noteLen / 120, 1) * 53);
  const ctx  = Math.round(obs * 0.45 + ev * 0.55);
  const crit = Math.round(ev * 0.45 + src * 0.35 + ver * 0.2);
  // Breadth: capped at 3 elements so 3 key ones = full score
  const brd  = Math.round(42 + Math.min(investigated.length / 3, 1) * 53);

  return [
    { label: "Observation Skills",   score: obs  },
    { label: "Evidence Weighting",   score: ev   },
    { label: "Source Tracing",       score: src  },
    { label: "Reasoning Quality",    score: rsn  },
    { label: "Verification Depth",   score: ver  },
    { label: "Context Analysis",     score: ctx  },
    { label: "Critical Thinking",    score: crit },
    { label: "Investigation Scope",  score: brd  },
  ];
}

function computeStrOpps(investigated: string[], notes: string) {
  const inv = new Set(investigated);
  const strengths: string[] = [];
  const opportunities: string[] = [];

  if (inv.has("headline"))        strengths.push("Identified emotional framing in the headline");
  if (inv.has("handle"))          strengths.push("Questioned the source account's credibility");
  if (inv.has("claim-medicines") || inv.has("claim-effects")) strengths.push("Examined the specific medical claims");
  if (inv.has("cta"))             strengths.push("Recognised urgency tactics in the call-to-action");
  if (notes.trim().length > 80)  strengths.push("Recorded written reasoning before deciding");
  if (inv.has("claim-everyone") || inv.has("claim-thousands")) strengths.push("Scrutinised the scope of the claims");

  if (!inv.has("handle"))         opportunities.push("Investigate the source domain and account age");
  if (!inv.has("claim-medicines") && !inv.has("claim-effects")) opportunities.push("Examine the specific medical claims more closely");
  if (!inv.has("headline"))       opportunities.push("Analyse the emotional framing in the headline");
  if (notes.trim().length < 60)  opportunities.push("Document reasoning with written observations before deciding");
  if (!inv.has("cta"))            opportunities.push("Consider what the urgency to share implies about the source");

  return { strengths: strengths.slice(0, 4), opportunities: opportunities.slice(0, 3) };
}

const VERDICT_DESCRIPTIONS: Record<NonNullable<Verdict>, string> = {
  TRUST:  "Content assessed as credible. Trust recorded.",
  VERIFY: "Content flagged for further verification.",
  REJECT: "Content rejected as false or misleading.",
  REPORT: "Content reported as harmful health misinformation.",
};

function CaseResolutionScreen({
  verdict, caseRecord, investigated, onReturn,
}: {
  verdict: NonNullable<Verdict>;
  caseRecord: CaseRecord;
  investigated: string[];
  onReturn: () => void;
}) {
  const color = STAMP_PALETTE[verdict].color;
  const categoryScores = computeScores(investigated, caseRecord.notebookNotes ?? "");
  const { strengths, opportunities } = computeStrOpps(investigated, caseRecord.notebookNotes ?? "");

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: "radial-gradient(ellipse at center, #0e0c08 0%, #07090f 100%)" }}>
      <div className="flex flex-col items-center py-10 px-4" style={{ minHeight: "100%" }}>

        {/* Verdict stamp */}
        <motion.div
          initial={{ scale: 4, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: -6, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          style={{ marginBottom: "10px" }}
        >
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color, letterSpacing: "0.3em", textAlign: "center", marginBottom: "4px", opacity: 0.7 }}>VERDICT</div>
          <div style={{
            fontFamily: "Special Elite, serif",
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            color,
            border: `8px solid ${color}`,
            padding: "0.2em 0.7em",
            letterSpacing: "0.14em",
            lineHeight: 1,
            boxShadow: `0 0 60px ${color}40`,
          }}>
            {verdict}
          </div>
        </motion.div>

        {/* Verdict description */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "rgba(201,162,39,0.55)", letterSpacing: "0.15em", marginBottom: "28px", textAlign: "center" }}
        >
          {VERDICT_DESCRIPTIONS[verdict]}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="flex gap-8 mb-8"
        >
          {[
            { label: "CASE", value: "2024-1147", color: "#c9a227" },
            { label: "EVIDENCE REVIEWED", value: `${caseRecord.verdictsGiven.length + 6}`, color: "#c9a227" },
            { label: "FINAL VERDICT", value: verdict, color },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "7px", color: "rgba(201,162,39,0.4)", letterSpacing: "0.18em", marginBottom: "4px" }}>{s.label}</div>
              <div style={{ fontFamily: "Special Elite, serif", fontSize: "18px", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </motion.div>

        {/* Investigation Report */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          style={{ width: "min(640px, 92vw)", marginBottom: "24px" }}
        >
          <div style={{ border: "1px solid rgba(201,162,39,0.25)", backgroundColor: "rgba(201,162,39,0.03)" }}>
            <div style={{ borderBottom: "1px solid rgba(201,162,39,0.18)", padding: "8px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "Special Elite, serif", fontSize: "15px", color: "#ffd966", letterSpacing: "0.12em" }}>INVESTIGATION REPORT</div>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "7px", color: "rgba(201,162,39,0.4)", letterSpacing: "0.14em" }}>CASE 2024-1147 · THE MIRACLE CURE</div>
            </div>

            {/* Category score bars — 2 columns */}
            <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
              {categoryScores.map(({ label, score }) => {
                const barColor = score >= 80 ? "#00ff6a" : score >= 60 ? "#c9a227" : "#e74c3c";
                const tier = score >= 80 ? "STRONG" : score >= 60 ? "DEVELOPING" : "EARLY";
                return (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                      <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "7px", color: "#b8a878", letterSpacing: "0.08em" }}>{label.toUpperCase()}</span>
                      <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "7px", color: barColor }}>{tier}</span>
                    </div>
                    <div style={{ height: "3px", backgroundColor: "rgba(201,162,39,0.12)" }}>
                      <div style={{ height: "100%", width: `${score}%`, backgroundColor: barColor, transition: "width 1.2s ease-out" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Strengths / Opportunities */}
            <div style={{ borderTop: "1px solid rgba(201,162,39,0.15)", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              {[
                { heading: "STRENGTHS",    headColor: "#00ff6a", items: strengths.length > 0 ? strengths : ["Made a final decision based on available evidence"] },
                { heading: "OPPORTUNITIES", headColor: "#c9a227", items: opportunities.length > 0 ? opportunities : ["Continue investigating additional post elements"] },
              ].map(({ heading, headColor, items }) => (
                <div key={heading} style={{ padding: "12px 18px", borderRight: heading === "STRENGTHS" ? "1px solid rgba(201,162,39,0.12)" : undefined }}>
                  <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "7px", color: headColor, letterSpacing: "0.18em", marginBottom: "8px" }}>{heading}</div>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "5px", alignItems: "flex-start" }}>
                      <span style={{ color: headColor, fontSize: "8px", lineHeight: 1.6, flexShrink: 0 }}>·</span>
                      <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "7.5px", color: "#b8a878", lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Commander Mira debrief */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}
          style={{ width: "min(640px, 92vw)", marginBottom: "28px" }}
        >
          <MiraPopup message={MIRA_DEBRIEFS[verdict]} />
        </motion.div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
          <button onClick={onReturn} style={{
            fontFamily: "Special Elite, serif", fontSize: "16px", letterSpacing: "0.18em",
            color: "#07090f", backgroundColor: color, border: "none",
            padding: "11px 32px", cursor: "pointer",
            boxShadow: `0 0 20px ${color}40`,
          }}>RETURN TO BUREAU</button>
        </motion.div>

      </div>
    </div>
  );
}

// ─── Detective records screen ─────────────────────────────────────────────────
const RECORDS_CATALOG = [
  {
    id: "techniques", title: "Investigation Techniques", color: "#00e9ff",
    entries: [
      { title: "Source Authentication", desc: "Verify the origin of any document before using it as evidence. Cross-reference three independent sources.", unlocked: true },
      { title: "Digital Trail Analysis", desc: "Follow metadata timestamps and file modification dates to reconstruct the chain of events.", unlocked: true },
      { title: "Behavioral Pattern Recognition", desc: "Identify deviations from a subject's established patterns — anomalies often signal deception.", unlocked: false },
    ],
  },
  {
    id: "warnings", title: "Warning Signs", color: "#e74c3c",
    entries: [
      { title: "Conflicting Timestamps", desc: "When document creation dates contradict stated timelines, treat the file as potentially fabricated.", unlocked: true },
      { title: "Metadata Stripping", desc: "Files with no metadata have been processed to remove identifying information. Treat with suspicion.", unlocked: false },
      { title: "Identical Phrasing Across Sources", desc: "Coordinated disinformation campaigns share phrasing templates. Flag verbatim repetition across sources.", unlocked: false },
    ],
  },
  {
    id: "checklists", title: "Verification Checklists", color: "#c9a227",
    entries: [
      { title: "Document Verification Protocol", desc: "1. Check metadata. 2. Verify source chain. 3. Cross-reference dates. 4. Confirm authorship.", unlocked: false },
      { title: "Witness Statement Review", desc: "Compare timeline against physical evidence. Note inconsistencies. Rate credibility on five-point scale.", unlocked: false },
    ],
  },
  {
    id: "concepts", title: "Key Concepts", color: "#9b59b6",
    entries: [
      { title: "Shadow Network", desc: "A coordinated disinformation operation. Multiple actors, single controller. Evidence is distributed to confuse.", unlocked: false },
      { title: "Dead Drop Evidence", desc: "Evidence planted deliberately for discovery. May appear authentic but is designed to mislead the investigation.", unlocked: false },
    ],
  },
  {
    id: "memory", title: "Memory Tips", color: "#00ff6a",
    entries: [
      { title: "The Red String Method", desc: "Physically map connections between suspects and evidence. Visual webs reveal patterns invisible in flat lists.", unlocked: false },
      { title: "Contradiction Logging", desc: "Write down every inconsistency immediately. Memory distorts under pressure. The notebook does not lie.", unlocked: false },
    ],
  },
  {
    id: "real-life", title: "Real-Life Application", color: "#b8a878",
    entries: [
      { title: "Lateral Reading", desc: "When verifying a source, leave it immediately and read what others say about it before returning to evaluate.", unlocked: false },
      { title: "Reverse Image Search", desc: "Drag any image into a search engine to trace its original context. Repurposed images are a common deception vector.", unlocked: false },
    ],
  },
];

function RecordsScreen({ onBack }: { onBack: () => void }) {
  const [openSection, setOpenSection] = useState<string | null>("techniques");

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "radial-gradient(ellipse at center,#191008 0%,#07090f 100%)" }}>
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: "1px solid rgba(201,162,39,0.18)", backgroundColor: "rgba(7,9,15,0.75)", flexShrink: 0 }}>
        <button onClick={onBack} style={{
          fontFamily: "Special Elite, serif", fontSize: "20px", letterSpacing: "0.15em",
          color: "#c9a227", border: "1px solid rgba(201,162,39,0.4)", backgroundColor: "transparent",
          padding: "5px 14px", cursor: "pointer",
        }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.textShadow = "0 0 12px rgba(201,162,39,0.7)"}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.textShadow = "none"}
        >← BUREAU</button>
        <div>
          <div style={{ fontFamily: "Special Elite, serif", fontSize: "20px", color: "#ffd966", letterSpacing: "0.08em" }}>DETECTIVE RECORDS</div>
          <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#b8a878", letterSpacing: "0.18em", marginTop: "2px" }}>FIELD MANUAL · CLASSIFIED TECHNIQUES · UNLOCK BY CLOSING CASES</div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Section sidebar */}
        <div className="flex-shrink-0 flex flex-col" style={{ width: "220px", borderRight: "1px solid rgba(201,162,39,0.12)", backgroundColor: "rgba(7,9,15,0.55)", overflowY: "auto", scrollbarWidth: "thin" }}>
          {RECORDS_CATALOG.map((sec) => {
            const unlockedCount = sec.entries.filter(e => e.unlocked).length;
            const isOpen = openSection === sec.id;
            return (
              <button key={sec.id} onClick={() => setOpenSection(isOpen ? null : sec.id)}
                style={{
                  textAlign: "left", padding: "14px 16px",
                  borderBottom: "1px solid rgba(201,162,39,0.08)",
                  borderLeft: `3px solid ${isOpen ? sec.color : "transparent"}`,
                  backgroundColor: isOpen ? "rgba(201,162,39,0.05)" : "transparent",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (!isOpen) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(201,162,39,0.03)"; }}
                onMouseLeave={(e) => { if (!isOpen) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: isOpen ? sec.color : "#c9b882", letterSpacing: "0.08em", marginBottom: "5px" }}>
                  {sec.title}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ flex: 1, height: "2px", backgroundColor: "rgba(201,162,39,0.1)" }}>
                    <div style={{ width: `${(unlockedCount / sec.entries.length) * 100}%`, height: "100%", backgroundColor: sec.color, opacity: 0.8 }} />
                  </div>
                  <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#6b5f42", whiteSpace: "nowrap" }}>
                    {unlockedCount}/{sec.entries.length}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: "thin" }}>
          {openSection ? (() => {
            const sec = RECORDS_CATALOG.find(s => s.id === openSection)!;
            return (
              <div className="flex flex-col gap-4 max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-2">
                  <div style={{ width: "3px", height: "28px", backgroundColor: sec.color }} />
                  <div style={{ fontFamily: "Special Elite, serif", fontSize: "23px", color: sec.color, letterSpacing: "0.07em" }}>{sec.title}</div>
                </div>
                {sec.entries.map((entry, i) => (
                  <div key={i} style={{
                    border: `1px solid ${entry.unlocked ? "rgba(201,162,39,0.25)" : "rgba(201,162,39,0.08)"}`,
                    borderLeft: `4px solid ${entry.unlocked ? sec.color : "rgba(201,162,39,0.12)"}`,
                    backgroundColor: entry.unlocked ? "rgba(201,162,39,0.03)" : "rgba(7,9,15,0.4)",
                    padding: "16px 20px",
                    opacity: entry.unlocked ? 1 : 0.5,
                    position: "relative",
                  }}>
                    <div className="flex items-start justify-between gap-4">
                      <div style={{ fontFamily: "Special Elite, serif", fontSize: "22px", color: entry.unlocked ? "#c9b882" : "#4a4438", letterSpacing: "0.05em", marginBottom: "6px" }}>
                        {entry.unlocked ? entry.title : "— CLASSIFIED —"}
                      </div>
                      {!entry.unlocked && (
                        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#3a3428", letterSpacing: "0.2em", flexShrink: 0 }}>LOCKED</div>
                      )}
                    </div>
                    <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "13px", color: entry.unlocked ? "#b8a878" : "#3a3428", lineHeight: 1.7 }}>
                      {entry.unlocked ? entry.desc : "Complete more cases to unlock this entry."}
                    </div>
                    {entry.unlocked && (
                      <div style={{ position: "absolute", top: "10px", right: "12px", width: "6px", height: "6px", borderRadius: "50%", backgroundColor: sec.color, opacity: 0.7 }} />
                    )}
                  </div>
                ))}
              </div>
            );
          })() : (
            <div className="flex flex-col items-center justify-center h-full" style={{ opacity: 0.3 }}>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#c9a227", letterSpacing: "0.25em" }}>SELECT A SECTION</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Settings screen ──────────────────────────────────────────────────────────
interface SettingsState {
  ambientSound: boolean;
  typewriterSfx: boolean;
  scanlines: boolean;
  highContrast: boolean;
  compactInterface: boolean;
  autoSave: boolean;
  showTimestamps: boolean;
  keyboardNav: boolean;
  hintAssistance: boolean;
  caseDifficulty: "rookie" | "detective" | "veteran";
  evidenceAutoLog: boolean;
  redactedWarning: boolean;
  reduceMotion: boolean;
  colorblindMode: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  ambientSound: true,
  typewriterSfx: true,
  scanlines: true,
  highContrast: false,
  compactInterface: false,
  autoSave: true,
  showTimestamps: true,
  keyboardNav: false,
  hintAssistance: false,
  caseDifficulty: "detective",
  evidenceAutoLog: true,
  redactedWarning: true,
  reduceMotion: false,
  colorblindMode: false,
};

function loadSettings(): SettingsState {
  try { const s = localStorage.getItem("dd_settings"); return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS; }
  catch { return DEFAULT_SETTINGS; }
}
function saveSettings(s: SettingsState) {
  try { localStorage.setItem("dd_settings", JSON.stringify(s)); } catch {}
}

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <span style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", letterSpacing: "0.18em", color: on ? "#c9a227" : "#3a3428", minWidth: "24px", textAlign: "right" }}>
        {on ? "ON" : "OFF"}
      </span>
      <button
        onClick={() => onChange(!on)}
        style={{
          width: "38px", height: "20px", position: "relative", cursor: "pointer",
          border: `1px solid ${on ? "#c9a227" : "rgba(201,162,39,0.22)"}`,
          backgroundColor: on ? "rgba(201,162,39,0.12)" : "rgba(7,9,15,0.7)",
          transition: "all 0.15s",
          flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", top: "2px",
          left: on ? "20px" : "2px",
          width: "14px", height: "14px",
          backgroundColor: on ? "#c9a227" : "#3a3428",
          transition: "left 0.15s, background-color 0.15s",
        }} />
      </button>
    </div>
  );
}

function SegmentedControl({
  options, value, onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-shrink-0" style={{ border: "1px solid rgba(201,162,39,0.3)" }}>
      {options.map((opt, i) => (
        <button key={opt.id} onClick={() => onChange(opt.id)} style={{
          fontFamily: "Courier Prime, monospace", fontSize: "10px", letterSpacing: "0.12em",
          padding: "5px 12px",
          color: value === opt.id ? "#07090f" : "#6b5f42",
          backgroundColor: value === opt.id ? "#c9a227" : "transparent",
          border: "none",
          borderLeft: i > 0 ? "1px solid rgba(201,162,39,0.3)" : "none",
          cursor: "pointer", transition: "all 0.15s",
        }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", letterSpacing: "0.28em", color: "#c9a227", marginBottom: "8px" }}>
        {label}
      </div>
      <div style={{ border: "1px solid rgba(201,162,39,0.22)", backgroundColor: "rgba(7,9,15,0.75)" }}>
        {children}
      </div>
    </div>
  );
}

function SettingsRow({
  title, desc, control,
}: {
  title: string; desc: string; control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3" style={{ borderBottom: "1px solid rgba(201,162,39,0.1)" }}>
      <div className="flex-1">
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#ffd966", letterSpacing: "0.06em", marginBottom: "2px" }}>{title}</div>
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#b8a878", lineHeight: 1.5 }}>{desc}</div>
      </div>
      {control}
    </div>
  );
}

function SettingsScreen({ onBack, profile, settings, onSettingsChange }: {
  onBack: () => void;
  profile: PlayerProfile | null;
  settings: SettingsState;
  onSettingsChange: (s: SettingsState) => void;
}) {
  const [clock, setClock] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
  });

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setClock(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const set = <K extends keyof SettingsState>(key: K, val: SettingsState[K]) => {
    const next = { ...settings, [key]: val };
    saveSettings(next);
    onSettingsChange(next);
  };

  const toggle = (key: keyof SettingsState) => set(key, !settings[key] as SettingsState[typeof key]);

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "radial-gradient(ellipse at center,#0d0c09 0%,#07090f 100%)" }}>
      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle 1px at 18px 18px, rgba(201,162,39,0.04) 0, transparent 0)",
        backgroundSize: "18px 18px",
      }} />

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(201,162,39,0.22)", backgroundColor: "rgba(7,9,15,0.82)" }}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} style={{
            fontFamily: "Special Elite, serif", fontSize: "20px", letterSpacing: "0.15em",
            color: "#c9a227", border: "1px solid rgba(201,162,39,0.4)", backgroundColor: "transparent",
            padding: "5px 14px", cursor: "pointer",
          }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.textShadow = "0 0 12px rgba(201,162,39,0.7)"}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.textShadow = "none"}
          >← BUREAU</button>
          <div>
            <div style={{ fontFamily: "Special Elite, serif", fontSize: "20px", color: "#ffd966", letterSpacing: "0.09em" }}>TERMINAL SETTINGS</div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#b8a878", letterSpacing: "0.2em", marginTop: "2px" }}>PRECINCT 14 · SYSTEM CONFIGURATION</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="dot-pulse flex-shrink-0" style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#00e9ff" }} />
          <div style={{ textAlign: "right" }}>
            <div className="cyan-flicker" style={{ fontFamily: "Courier Prime, monospace", fontSize: "10px", color: "#00e9ff", letterSpacing: "0.15em" }}>SYSTEM ONLINE</div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#b8a878", letterSpacing: "0.12em", marginTop: "2px" }}>{clock} · PRECINCT 14</div>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="relative flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: "thin" }}>
        <div className="max-w-2xl mx-auto flex flex-col gap-6">

          <SettingsSection label="AUDIO">
            <SettingsRow
              title="Ambient Soundscape"
              desc="Background atmosphere audio — rain, static, city ambience."
              control={<ToggleSwitch on={settings.ambientSound} onChange={(v) => set("ambientSound", v)} />}
            />
            <SettingsRow
              title="Typewriter Sound Effects"
              desc="Keystroke audio feedback on evidence stamps and input fields."
              control={<ToggleSwitch on={settings.typewriterSfx} onChange={(v) => set("typewriterSfx", v)} />}
            />
          </SettingsSection>

          <SettingsSection label="DISPLAY">
            <SettingsRow
              title="CRT Scanlines"
              desc="Retro terminal scanline overlay effect across all screens."
              control={<ToggleSwitch on={settings.scanlines} onChange={(v) => set("scanlines", v)} />}
            />
            <SettingsRow
              title="High Contrast Mode"
              desc="Enhanced text visibility — boosts foreground brightness."
              control={<ToggleSwitch on={settings.highContrast} onChange={(v) => set("highContrast", v)} />}
            />
            <SettingsRow
              title="Compact Interface"
              desc="Reduced padding and spacing for smaller display sizes."
              control={<ToggleSwitch on={settings.compactInterface} onChange={(v) => set("compactInterface", v)} />}
            />
          </SettingsSection>

          <SettingsSection label="CONTROLS">
            <SettingsRow
              title="Auto-Save Progress"
              desc="Automatically saves case state after each major action."
              control={<ToggleSwitch on={settings.autoSave} onChange={(v) => set("autoSave", v)} />}
            />
            <SettingsRow
              title="Show Timestamps"
              desc="Display time metadata on all case records and evidence entries."
              control={<ToggleSwitch on={settings.showTimestamps} onChange={(v) => set("showTimestamps", v)} />}
            />
            <SettingsRow
              title="Keyboard Navigation"
              desc="Full keyboard shortcut support for stamp actions and tab switching."
              control={<ToggleSwitch on={settings.keyboardNav} onChange={(v) => set("keyboardNav", v)} />}
            />
          </SettingsSection>

          <SettingsSection label="GAMEPLAY">
            <SettingsRow
              title="Hint Assistance"
              desc="Receive a nudge after repeated incorrect guesses or prolonged inactivity."
              control={<ToggleSwitch on={settings.hintAssistance} onChange={(v) => set("hintAssistance", v)} />}
            />
            <SettingsRow
              title="Case Difficulty"
              desc="Adjusts suspect pool size and evidence ambiguity across all cases."
              control={
                <SegmentedControl
                  options={[
                    { id: "rookie", label: "ROOKIE" },
                    { id: "detective", label: "DETECTIVE" },
                    { id: "veteran", label: "VETERAN" },
                  ]}
                  value={settings.caseDifficulty}
                  onChange={(v) => set("caseDifficulty", v as SettingsState["caseDifficulty"])}
                />
              }
            />
            <SettingsRow
              title="Evidence Auto-Log"
              desc="Automatically pins newly found clues to the Evidence Wall as you investigate."
              control={<ToggleSwitch on={settings.evidenceAutoLog} onChange={(v) => set("evidenceAutoLog", v)} />}
            />
            <SettingsRow
              title="Redacted Content Warning"
              desc="Warn before displaying sensitive or graphically disturbing case material."
              control={<ToggleSwitch on={settings.redactedWarning} onChange={(v) => set("redactedWarning", v)} />}
            />
            <SettingsRow
              title="Reduce Motion"
              desc="Disables background parallax drift, menu animations, and prop sway."
              control={<ToggleSwitch on={settings.reduceMotion} onChange={(v) => set("reduceMotion", v)} />}
            />
            <SettingsRow
              title="Colorblind-Safe Mode"
              desc="Remaps red/green status indicators to amber/cyan using existing palette tokens."
              control={<ToggleSwitch on={settings.colorblindMode} onChange={(v) => set("colorblindMode", v)} />}
            />
          </SettingsSection>

        </div>
      </div>

      {/* Footer */}
      <div className="relative flex items-center justify-between px-5 py-2 flex-shrink-0" style={{ borderTop: "1px solid rgba(201,162,39,0.12)", backgroundColor: "rgba(7,9,15,0.75)" }}>
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#3a3428", letterSpacing: "0.14em" }}>
          TERMINAL CONFIGURATION · {profile?.badgeId ?? "DDI-UNKNOWN"}
        </div>
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#3a3428", letterSpacing: "0.14em" }}>
          CASE ENGINE REV 14 · BUILD 2024-07-12 · VER 1.0.0
        </div>
      </div>
    </div>
  );
}

// ─── Stub screens ─────────────────────────────────────────────────────────────
function StubScreen({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ backgroundColor: "#07090f" }}>
      <div style={{ transform: "rotate(-4deg)", textAlign: "center", marginBottom: "32px" }}>
        <div style={{ fontFamily: "Special Elite, serif", fontSize: "28px", color: "#c9a227", letterSpacing: "0.1em" }}>{title}</div>
        <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#b8a878", letterSpacing: "0.2em", marginTop: "6px" }}>{sub}</div>
      </div>
      <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "rgba(201,162,39,0.3)", letterSpacing: "0.22em", marginBottom: "28px" }}>
        — UNDER CONSTRUCTION —
      </div>
      <button
        onClick={onBack}
        style={{
          fontFamily: "Special Elite, serif",
          fontSize: "20px",
          letterSpacing: "0.2em",
          color: "#c9a227",
          border: "1px solid rgba(201,162,39,0.4)",
          backgroundColor: "transparent",
          padding: "10px 28px",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.textShadow = "0 0 12px rgba(201,162,39,0.7)"}
        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.textShadow = "none"}
      >
        ← BACK
      </button>
    </div>
  );
}

// ─── Screen nav ───────────────────────────────────────────────────────────────
const SCREENS: { id: Screen; label: string }[] = [
  { id: "investigation", label: "CASE FILE" },
];

// ─── Main App ─────────────────────────────────────────────────────────────────
const PRE_GAME: Screen[] = ["boot", "splash", "recruitment-letter", "profile-creation", "mira-onboarding", "main-menu", "case-select", "mission-briefing", "records", "settings", "profile"];

export default function App() {
  const [screen, setScreen]     = useState<Screen>("boot");
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(() => loadProfile());
  const [cases, setCases]     = useState<CaseRecord[]>(loadCases);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(() => {
    const stored = loadCases();
    return stored.find(c => c.status === "in-progress")?.caseId ?? null;
  });
  const [finalVerdict, setFinalVerdict] = useState<NonNullable<Verdict> | null>(null);
  const [resolutionInvestigated, setResolutionInvestigated] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingsState>(loadSettings);

  const activeCase = activeCaseId ? cases.find(c => c.caseId === activeCaseId) ?? null : null;

  const updateCase = useCallback((caseId: string, updater: (r: CaseRecord) => CaseRecord) => {
    setCases(prev => {
      const next = prev.map(c => c.caseId === caseId ? updater(c) : c);
      saveCases(next);
      return next;
    });
  }, []);

  // Persist lastScreen whenever we switch game screens
  useEffect(() => {
    if (!PRE_GAME.includes(screen) && screen !== "case-resolution" && activeCaseId) {
      updateCase(activeCaseId, r => ({ ...r, lastScreen: screen }));
    }
  }, [screen, activeCaseId, updateCase]);

  // Timer — ambient pressure display only; cases now close only via verdict buttons
  useEffect(() => {
    if (screen !== "investigation") return;
    if (!activeCase || activeCase.status !== "in-progress") return;
    if (activeCase.timeRemainingSec <= 0) return;
    const t = setInterval(() => {
      updateCase(activeCase.caseId, r => ({
        ...r, timeRemainingSec: Math.max(0, r.timeRemainingSec - 1),
      }));
    }, 1000);
    return () => clearInterval(t);
  }, [screen, activeCaseId]);

  // New players → recruitment letter; returning players → main menu
  const handleSplashDone = useCallback(() => {
    setScreen(loadProfile() ? "main-menu" : "recruitment-letter");
  }, []);

  const handleProfileSave = useCallback((p: PlayerProfile) => {
    setProfile(p);
    setScreen("mira-onboarding");
  }, []);

  const handleCaseSelect = useCallback((caseId: string, resume: boolean) => {
    setActiveCaseId(caseId);
    if (!resume) {
      // Fresh start — reset case state; land directly in investigation
      updateCase(caseId, r => ({ ...r, status: "in-progress", verdictsGiven: [], wallSelection: null, timeRemainingSec: 847, lastScreen: "investigation" }));
    }
    const storedScreen = cases.find(c => c.caseId === caseId)?.lastScreen;
    const validResumeScreens = new Set<Screen>(["investigation"]);
    const resumeTarget: Screen = (storedScreen && validResumeScreens.has(storedScreen)) ? storedScreen : "investigation";
    setScreen(resume ? resumeTarget : "investigation");
  }, [cases, updateCase]);

  const handleVerdictFinal = useCallback((v: NonNullable<Verdict>, investigated: string[]) => {
    if (!activeCaseId) return;
    updateCase(activeCaseId, r => ({ ...r, status: "closed-solved", finalVerdict: v, lastScreen: "case-resolution" }));
    setFinalVerdict(v);
    setResolutionInvestigated(investigated);
    setScreen("case-resolution");
  }, [activeCaseId, updateCase]);

  const handleBackToBureau = useCallback(() => {
    setFinalVerdict(null);
    setScreen("main-menu");
    // If case is now closed, clear activeCaseId
    setCases(prev => {
      const closed = prev.find(c => c.caseId === activeCaseId && c.status === "closed-solved");
      if (closed) setActiveCaseId(null);
      return prev;
    });
  }, [activeCaseId]);

  const handleBackToMenu = useCallback(() => setScreen("main-menu"), []);

  const handleUpdateNotebookNotes = useCallback((caseId: string, notes: string) => {
    updateCase(caseId, r => ({ ...r, notebookNotes: notes }));
  }, [updateCase]);

  const handleDiscoverFinding = useCallback((finding: DiscoveredFinding) => {
    if (!activeCaseId) return;
    updateCase(activeCaseId, r => {
      const already = (r.discoveredFindings ?? []).some(f => f.elementId === finding.elementId && f.toolId === finding.toolId);
      if (already) return r;
      return { ...r, discoveredFindings: [...(r.discoveredFindings ?? []), finding] };
    });
  }, [activeCaseId, updateCase]);

  const isPreGame = PRE_GAME.includes(screen);
  const isCritical = false; // Cases no longer end via evidence wall — TRUST/VERIFY/REJECT/REPORT closes cases

  return (
    <div
      className="w-screen h-screen overflow-hidden flex flex-col select-none"
      style={{ backgroundColor: "#07090f", color: "#c9b882", fontFamily: "Courier Prime, monospace" }}
    >
      <StyleInjector />
      <Grain />
      <ScanLines />
      <Vignette />

      {/* In-game header — hidden on splash / menu / stub / resolution / notebook (has its own header) */}
      {!isPreGame && screen !== "case-resolution" && screen !== "notebook" && (
        <header
          className="flex items-center justify-between px-4 py-2 relative flex-shrink-0"
          style={{ backgroundColor: "rgba(3,5,12,0.97)", borderBottom: "1px solid rgba(201,162,39,0.25)", zIndex: 150 }}
        >
          {/* Left: back button + case stamp */}
          <div className="flex items-center gap-4">
            {activeCase?.status === "in-progress" ? (
              <div style={{
                fontFamily: "Courier Prime, monospace", fontSize: "10px", letterSpacing: "0.18em",
                color: "rgba(201,162,39,0.28)", border: "1px solid rgba(201,162,39,0.12)",
                padding: "4px 12px", userSelect: "none",
              }} title="COMPLETE THE INVESTIGATION TO EXIT">
                CASE ACTIVE
              </div>
            ) : (
              <button
                onClick={handleBackToMenu}
                title={isCritical ? "FINISH OR ABANDON THEORY" : undefined}
                style={{
                  fontFamily: "Special Elite, serif", fontSize: "22px", letterSpacing: "0.15em",
                  color: isCritical ? "#3a3428" : "#c9a227",
                  border: `1px solid ${isCritical ? "rgba(201,162,39,0.15)" : "rgba(201,162,39,0.4)"}`,
                  backgroundColor: "transparent", padding: "4px 12px",
                  cursor: isCritical ? "not-allowed" : "pointer",
                  transition: "text-shadow 0.2s",
                }}
                onMouseEnter={(e) => { if (!isCritical) (e.currentTarget as HTMLElement).style.textShadow = "0 0 12px rgba(201,162,39,0.7)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textShadow = "none"; }}
              >
                ← BUREAU
              </button>
            )}
            <div style={{ transform: "rotate(-3.5deg)", lineHeight: 1 }}>
              <div className="amber-glow" style={{ fontFamily: "Special Elite, serif", fontSize: "20px", color: "#ffd966", letterSpacing: "0.1em" }}>
                {activeCaseId ?? "CASE 2024-1147"}
              </div>
              <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#b8a878", letterSpacing: "0.22em" }}>
                {CASES_CATALOG.find(c => c.caseId === activeCaseId)?.title ?? "THE MIRACLE CURE"} · ACTIVE
              </div>
            </div>
          </div>

          {/* Screen tabs */}
          <nav className="flex gap-0.5">
            {SCREENS.map((s) => (
              <button key={s.id} onClick={() => setScreen(s.id)} style={{
                fontFamily: "Courier Prime, monospace", fontSize: "9px", letterSpacing: "0.16em", padding: "5px 13px",
                color: screen === s.id ? "#07090f" : "#c9b882",
                backgroundColor: screen === s.id ? "#c9a227" : "transparent",
                border: `1px solid ${screen === s.id ? "#c9a227" : "rgba(201,162,39,0.22)"}`,
                cursor: "pointer", transition: "all 0.18s",
              }}
                onMouseEnter={(e) => { if (screen !== s.id) (e.currentTarget as HTMLElement).style.color = "#ffd966"; }}
                onMouseLeave={(e) => { if (screen !== s.id) (e.currentTarget as HTMLElement).style.color = "#c9b882"; }}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* Status right */}
          <div style={{ textAlign: "right" }}>
            <div className="cyan-flicker" style={{ fontFamily: "Courier Prime, monospace", fontSize: "9px", color: "#00e9ff", letterSpacing: "0.15em" }}>
              ● ACTIVE INVESTIGATION
            </div>
            <div style={{ fontFamily: "Courier Prime, monospace", fontSize: "9.5px", color: "#b8a878", letterSpacing: "0.12em", marginTop: "2px" }}>
              {activeCase ? `${Math.floor(activeCase.timeRemainingSec / 60).toString().padStart(2,"0")}:${(activeCase.timeRemainingSec % 60).toString().padStart(2,"0")} · PRECINCT 14` : "02:47:33 · PRECINCT 14"}
            </div>
          </div>
        </header>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative" style={{ zIndex: 120 }}>
        <AnimatePresence mode="wait">
          <motion.div key={screen} className="absolute inset-0"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            {screen === "boot"               && <BootScreen onDone={() => setScreen("splash")} />}
            {screen === "splash"              && <SplashScreen onDone={handleSplashDone} />}
            {screen === "recruitment-letter" && <RecruitmentLetterScreen onAccept={() => setScreen("profile-creation")} />}
            {screen === "profile-creation"   && <ProfileCreationScreen onSave={handleProfileSave} />}
            {screen === "mira-onboarding"    && <MiraOnboardingScreen onDone={() => setScreen("main-menu")} />}
            {screen === "main-menu"          && <MainMenuScreen onNavigate={setScreen} cases={cases} reduceMotion={settings.reduceMotion} settings={settings} profile={profile} />}
            {screen === "case-select"     && <CaseSelectScreen cases={cases} onSelect={handleCaseSelect} onBrief={(id) => { setPendingCaseId(id); setScreen("mission-briefing"); }} onBack={handleBackToMenu} />}
            {screen === "mission-briefing" && pendingCaseId && (
              <MissionBriefingScreen
                caseId={pendingCaseId}
                onAccept={() => { handleCaseSelect(pendingCaseId, false); setPendingCaseId(null); }}
                onBack={() => { setPendingCaseId(null); setScreen("case-select"); }}
              />
            )}
            {screen === "records"         && <RecordsScreen onBack={handleBackToMenu} />}
            {screen === "settings"        && <SettingsScreen onBack={handleBackToMenu} profile={profile} settings={settings} onSettingsChange={setSettings} />}
            {screen === "investigation"   && <InvestigationScreen onVerdictFinal={handleVerdictFinal} onDiscoverFinding={handleDiscoverFinding} />}
            {screen === "notebook"        && <NotebookScreen cases={cases} onUpdateNotes={handleUpdateNotebookNotes} onBack={handleBackToMenu} />}
            {screen === "profile"         && <ProfileScreen profile={profile} onBack={handleBackToMenu} />}
            {screen === "evidence-wall"   && <EvidenceWallScreen cases={cases} />}
            {screen === "case-resolution" && finalVerdict && activeCase && (
              <CaseResolutionScreen
                verdict={finalVerdict}
                caseRecord={activeCase}
                investigated={resolutionInvestigated}
                onReturn={handleBackToBureau}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}