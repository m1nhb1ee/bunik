import type { CSSProperties, ReactNode } from "react";

/** Shared sketchbook design tokens + primitives used across every page. */
export const B = {
  ink: "#2B2722",
  paper: "#F4EEE1",
  paperLight: "#FBF7EE",
  terracotta: "#C2603F",
  honey: "#CE9B4E",
  teal: "#2E6A62",
  olive: "#7E8F5E",
  plum: "#9B6A78",
  indigo: "#4A5A7A",
  rust: "#A84B30",
  brown: "#8A7C68",
  muted: "#94806A",
  body: "#5A5046",
} as const;

const ACCENTS = [B.terracotta, B.teal, B.honey, B.indigo, B.plum, B.olive, B.rust, B.brown];

/** Deterministic accent colour from any string key. */
export function accentFor(key: string): string {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return ACCENTS[h % ACCENTS.length];
}

/** Hand-drawn sparkline path + dots from a numeric series (mock grid 128x46). */
export function spark(values: number[]) {
  const W = 128, H = 46, p = 6, n = values.length;
  if (n === 0) return { path: "", dots: [] as { x: number; y: number }[], last: "0" };
  const mn = Math.min(...values), mx = Math.max(...values), rng = mx - mn || 1;
  const pts = values.map((v, i) => ({
    x: +(p + (i * (W - 2 * p)) / Math.max(1, n - 1)).toFixed(1),
    y: +(H - p - ((v - mn) / rng) * (H - 2 * p)).toFixed(1),
  }));
  const path = pts.map((pt, i) => (i ? "L" : "M") + pt.x + " " + pt.y).join(" ");
  return { path, dots: pts, last: values[values.length - 1].toFixed(1) };
}

/** Wobbly hand-drawn star rating row. */
export function StarRow({
  value,
  size = 15,
  onChange,
}: {
  value: number;
  size?: number;
  onChange?: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 18 18"
          style={{ overflow: "visible", cursor: onChange ? "pointer" : "inherit" }}
          onClick={onChange ? () => onChange(i) : undefined}
        >
          <path
            d="M9 2 L11 7 L16 8 L11 9.5 L9 15 L7 9.5 L2 8 L7 7 Z"
            fill={i <= Math.round(value) ? B.honey : "none"}
            stroke={B.ink}
            strokeWidth="1.2"
            strokeLinejoin="round"
            filter="url(#inkrough2)"
          />
        </svg>
      ))}
    </div>
  );
}

/** Heading with a drawn ink underline squiggle. */
export function SketchHeading({
  children,
  color = B.terracotta,
  width = "72%",
  size = "clamp(2rem,4vw,2.9rem)",
  kicker,
}: {
  children: ReactNode;
  color?: string;
  width?: string | number;
  size?: string;
  kicker?: string;
}) {
  return (
    <div>
      {kicker && (
        <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 20, color: B.muted, margin: "0 0 4px" }}>{kicker}</p>
      )}
      <h1
        style={{
          position: "relative",
          display: "inline-block",
          fontFamily: "'Shantell Sans', cursive",
          fontWeight: 700,
          fontSize: size,
          color: B.ink,
          margin: 0,
        }}
      >
        {children}
        <svg viewBox="0 0 420 14" style={{ position: "absolute", left: 0, bottom: -10, width, height: 12, overflow: "visible" }}>
          <path
            style={{ animation: "drawIn 1.1s both .3s" }}
            pathLength={1}
            strokeDasharray="1"
            d="M3 8 C 110 2, 240 13, 340 5 C 380 2, 405 7, 417 5"
            stroke={color}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            filter="url(#inkrough)"
          />
        </svg>
      </h1>
    </div>
  );
}

/** Back link with a drawn arrow. */
export function BackArrow() {
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" style={{ overflow: "visible" }}>
      <path d="M21 6 L3 6 M9 1 L2 6 L9 11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#inkrough2)" />
    </svg>
  );
}

/** Card surface base (paper + ink border + offset shadow). Compose with overrides. */
export function cardStyle(opts: { radius?: string; shadow?: string; rot?: string } = {}): CSSProperties {
  return {
    background: B.paperLight,
    border: `2px solid ${B.ink}`,
    borderRadius: opts.radius ?? "19px 23px 18px 22px/22px 18px 23px 19px",
    boxShadow: opts.shadow ?? "5px 6px 0 rgba(43,39,34,0.13)",
    ...(opts.rot ? { rotate: opts.rot } : {}),
  };
}

/** Dashed ink rule used as a divider. */
export const dashedRule: CSSProperties = {
  height: 1,
  background: "repeating-linear-gradient(90deg,#94806A 0 7px,transparent 7px 13px)",
  opacity: 0.45,
};

/** Loading + empty states in the sketchbook tone. */
export function CenterNote({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <svg width="60" height="60" viewBox="0 0 42 42" style={{ overflow: "visible", animation: "twinkle 2.6s ease-in-out infinite", marginBottom: 14 }}>
        <path d="M21 4 L24 17 L37 21 L24 25 L21 38 L18 25 L5 21 L18 17 Z" fill={B.honey} stroke={B.ink} strokeWidth="1.6" strokeLinejoin="round" filter="url(#inkrough2)" />
      </svg>
      <p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 19, color: B.ink, margin: 0 }}>{title}</p>
      {sub && <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 18, color: B.muted, margin: "6px 0 0" }}>{sub}</p>}
    </div>
  );
}
