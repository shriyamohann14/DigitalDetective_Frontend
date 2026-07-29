// ─── Recruitment intro wrapper ─────────────────────────────────────────────
// Composes DeskBackground around whatever is passed as children (the
// existing recruitment letter JSX, completely untouched).
//
// This component owns the "desk" presentation only. It does not know or
// care what's inside it — swap the letter for anything and the intro still
// works the same way.
//
// Structural note: this replaces the recruitment screen's old outer
// `<div className="absolute inset-0 overflow-y-auto">` wrapper 1:1 (same
// classes, same positioning behavior) — it just adds the desk layer and a
// slide-in transform around the content instead of a flat background.

import { motion } from "motion/react";
import { DeskBackground } from "./DeskBackground";

const PAPER_SLIDE_DELAY = 0.2;
const PAPER_SLIDE_DURATION = 1.3;

export function RecruitmentIntro({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: "#07090f" }}>
      <DeskBackground />

      {/* Letter slides down onto the desk and settles. The letter itself
          (children) keeps its own existing fade/slide animation untouched —
          this wrapper only adds the larger "arriving on the desk" motion
          around it. */}
      <motion.div
        initial={{ y: -540, scale: 0.985 }}
        animate={{ y: 0, scale: [0.985, 0.985, 1] }}
        transition={{
          duration: PAPER_SLIDE_DURATION,
          delay: PAPER_SLIDE_DELAY,
          times: [0, 0.08, 1],
          ease: "easeOut",
        }}
        style={{ position: "relative", zIndex: 10, minHeight: "100%" }}
      >
        {children}
      </motion.div>
    </div>
  );
}