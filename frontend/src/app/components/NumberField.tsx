import { useEffect, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent } from "react";

type NumberFieldProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Increment applied with the Up/Down arrow keys. */
  step?: number;
  /** Rounding precision applied when the field loses focus. */
  decimals?: number;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  id?: string;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const roundTo = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

/**
 * Numeric input without native spinner buttons. Backed by a text field so the
 * box can be cleared and typed into freely (including partial decimals like
 * "8."); the value is clamped/rounded only when focus leaves. Up/Down arrows
 * still step the value.
 */
export function NumberField({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  decimals = 1,
  placeholder = "0",
  className,
  style,
  ariaLabel,
  id,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(() => (value ? String(value) : ""));
  const [focused, setFocused] = useState(false);

  // Mirror external changes (e.g. profile load, "clear filters") while idle.
  useEffect(() => {
    if (!focused) setDraft(value ? String(value) : "");
  }, [value, focused]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(",", ".");
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    setDraft(raw);
    const parsed = raw === "" || raw === "." ? 0 : Number(raw);
    if (!Number.isNaN(parsed)) onChange(clamp(parsed, min, max));
  };

  const handleBlur = () => {
    setFocused(false);
    if (draft === "" || draft === ".") {
      onChange(clamp(0, min, max));
      setDraft("");
      return;
    }
    const next = clamp(roundTo(Number(draft), decimals), min, max);
    onChange(next);
    setDraft(String(next));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const base = draft === "" || draft === "." ? 0 : Number(draft);
    if (Number.isNaN(base)) return;
    const next = clamp(roundTo(base + (event.key === "ArrowUp" ? step : -step), decimals), min, max);
    setDraft(String(next));
    onChange(next);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={() => setFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      style={style}
    />
  );
}
