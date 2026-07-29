// ─── Desk background layer ──────────────────────────────────────────────────
// Replaces the flat black/gradient backdrop behind the recruitment letter
// with a top-down wooden desk, a cinematic vignette, and a soft warm light
// pool. Purely decorative (aria-hidden, pointer-events: none) — does not
// affect layout or interaction of anything rendered on top of it.
//
// To swap the desk texture later, just replace src/assets/wood-desk.jpg
// with a real photo (same filename, any resolution — it's rendered with
// object-fit: cover so it will always fill the screen correctly).

import deskTexture from "../../assets/wood-desk.jpg";

// ─── Stationary props ───────────────────────────────────────────────────────
// Small decorative SVG elements scattered around the desk edges, kept out of
// the center where the letter lands. Rendered *before* the vignette/edge-tie
// overlays below so they get the same natural corner-darkening as the rest
// of the desk photo, instead of sitting on top looking pasted-in.

function MagnifyingGlassProp({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", width: 84, height: 84, opacity: 0.85, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.55))", ...style }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <circle cx="42" cy="42" r="26" fill="rgba(180,210,220,0.10)" stroke="#c9a227" strokeWidth="4" />
        <circle cx="42" cy="42" r="26" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <line x1="61" y1="61" x2="88" y2="88" stroke="#8a6a2f" strokeWidth="7" strokeLinecap="round" />
        <line x1="61" y1="61" x2="88" y2="88" stroke="#c9a227" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function CoffeeRingProp({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", width: 70, height: 70, opacity: 0.35, ...style }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <ellipse cx="50" cy="52" rx="38" ry="34" fill="none" stroke="#3a2510" strokeWidth="3" />
        <ellipse cx="50" cy="52" rx="30" ry="27" fill="none" stroke="#3a2510" strokeWidth="1.5" opacity="0.6" />
      </svg>
    </div>
  );
}

function PaperclipProp({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", width: 40, height: 60, opacity: 0.8, filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))", ...style }}>
      <svg viewBox="0 0 40 60" width="100%" height="100%">
        <path
          d="M12 10 C12 4 20 4 20 10 L20 44 C20 50 30 50 30 44 L30 16"
          fill="none" stroke="#9aa5ad" strokeWidth="3.2" strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function FountainPenProp({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", width: 140, height: 26, opacity: 0.9, filter: "drop-shadow(0 5px 8px rgba(0,0,0,0.55))", ...style }}>
      <svg viewBox="0 0 140 26" width="100%" height="100%">
        <rect x="10" y="9" width="100" height="8" rx="4" fill="#1a1005" />
        <rect x="10" y="9" width="100" height="3" rx="1.5" fill="#3a2510" opacity="0.5" />
        <rect x="60" y="7" width="10" height="12" fill="#c9a227" opacity="0.85" />
        <path d="M110 10 L134 13 L110 16 Z" fill="#2a1a0a" />
      </svg>
    </div>
  );
}

function PushpinProp({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", width: 22, height: 22, opacity: 0.85, filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.55))", ...style }}>
      <svg viewBox="0 0 22 22" width="100%" height="100%">
        <circle cx="11" cy="11" r="8" fill="#a3231f" />
        <circle cx="8.5" cy="8.5" r="2.4" fill="rgba(255,255,255,0.35)" />
      </svg>
    </div>
  );
}

function FolderCornerProp({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", width: 160, height: 90, opacity: 0.5, filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.6))", ...style }}>
      <svg viewBox="0 0 160 90" width="100%" height="100%">
        <rect x="0" y="10" width="160" height="80" rx="2" fill="#8B5E3C" />
        <rect x="0" y="0" width="70" height="18" rx="2" fill="#a9713f" />
      </svg>
    </div>
  );
}

export function DeskBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <img
        src={deskTexture}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
        }}
      />

      {/* soft warm top-down light pool, centered where the letter lands */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 55% 42% at 50% 36%, rgba(255,214,150,0.16) 0%, rgba(255,214,150,0) 70%)",
        }}
      />

      {/* organized stationary — framing the letter, kept off-center so it
          never competes with or sits behind where the paper lands */}
      <MagnifyingGlassProp style={{ top: "6%", left: "5%", transform: "rotate(-12deg)" }} />
      <CoffeeRingProp style={{ top: "9%", right: "7%", transform: "rotate(4deg)" }} />
      <PushpinProp style={{ top: "48%", left: "3.5%" }} />
      <PaperclipProp style={{ bottom: "14%", left: "8%", transform: "rotate(18deg)" }} />
      <FountainPenProp style={{ bottom: "8%", right: "9%", transform: "rotate(-6deg)" }} />
      <FolderCornerProp style={{ bottom: "0%", left: "40%", transform: "rotate(-2deg)" }} />

      {/* cinematic vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 32%, rgba(0,0,0,0.72) 100%)",
        }}
      />

      {/* tie the edges back to the app's near-black tone so the transition
          into surrounding screens stays consistent */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 240px 70px rgba(7,9,15,0.92)",
        }}
      />
    </div>
  );
}