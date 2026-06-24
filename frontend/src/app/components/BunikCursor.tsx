import { useEffect, useRef } from "react";

/**
 * Hand-drawn cursor from the bunik design: a little sun that swaps to a cloud
 * when hovering anything interactive. Follows the pointer via transform.
 * Hidden on touch / coarse-pointer devices (handled in CSS).
 */
export function BunikCursor() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;

    let on = false;

    const move = (e: PointerEvent) => {
      // translate3d keeps the cursor on its own compositor layer → moves with
      // the pointer in the same frame, no repaint lag.
      el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      if (!on) {
        on = true;
        el.classList.add("is-on");
      }
      const target = e.target as Element | null;
      const pointer =
        target &&
        target.closest &&
        target.closest("a,button,[role=button],[data-clk],input,select,textarea,label");
      el.classList.toggle("is-pointer", !!pointer);
    };

    const leave = () => {
      on = false;
      el.classList.remove("is-on");
    };

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("mouseleave", leave);

    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("mouseleave", leave);
    };
  }, []);

  return (
    <div id="bunik-cursor" ref={ref} aria-hidden="true">
      <svg className="bk-cur-cloud" width="34" height="24" viewBox="0 0 34 24">
        <path
          d="M9 21 Q1 21 1 14 Q1 8 8 8 Q9 2 16 2 Q23 2 24 9 Q33 9 33 15.5 Q33 21 26 21 Z"
          fill="#FBF7EE"
          stroke="#2B2722"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M9 14 Q11 12 13 14" fill="none" stroke="#4A5A7A" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <svg className="bk-cur-sun" width="30" height="30" viewBox="0 0 30 30">
        <g stroke="#C2603F" strokeWidth="2" strokeLinecap="round">
          <line x1="15" y1="1" x2="15" y2="5" />
          <line x1="15" y1="25" x2="15" y2="29" />
          <line x1="1" y1="15" x2="5" y2="15" />
          <line x1="25" y1="15" x2="29" y2="15" />
          <line x1="5" y1="5" x2="8" y2="8" />
          <line x1="22" y1="22" x2="25" y2="25" />
          <line x1="25" y1="5" x2="22" y2="8" />
          <line x1="8" y1="22" x2="5" y2="25" />
        </g>
        <circle cx="15" cy="15" r="6.5" fill="#CE9B4E" stroke="#2B2722" strokeWidth="1.8" />
      </svg>
    </div>
  );
}
