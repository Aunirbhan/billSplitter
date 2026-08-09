import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatCents } from "../split";

export function Button({
  children,
  onClick,
  kind = "primary",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger" | "mint";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: "bg-accent text-accent-ink font-semibold active:scale-[0.98]",
    mint: "bg-money text-accent-ink font-semibold active:scale-[0.98]",
    ghost: "bg-card-hi text-ink border border-line active:scale-[0.98]",
    danger: "bg-transparent text-danger border border-danger/40 active:scale-[0.98]",
  }[kind];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-6 py-3.5 text-base transition-transform disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/** Money number that tweens between values — the "growing total". */
export function AnimatedMoney({ cents, className = "" }: { cents: number; className?: string }) {
  const [display, setDisplay] = useState(cents);
  const fromRef = useRef(cents);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = cents;
    if (from === to) return;
    const start = performance.now();
    const dur = 380;
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cents]);

  return <span className={`tabular-nums ${className}`}>{formatCents(display)}</span>;
}

export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="pop-in relative w-full max-w-md rounded-t-3xl bg-card border-t border-line p-5 safe-bottom max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "decimal" | "tel";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-dim">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-card-hi px-4 py-3 text-ink placeholder:text-dim/60 focus:border-accent focus:outline-none"
      />
    </label>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-card-hi">
      <button
        className="px-3.5 py-2 text-xl text-dim active:text-ink"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="min-w-8 text-center text-base font-semibold tabular-nums">
        {value}
        {suffix}
      </span>
      <button className="px-3.5 py-2 text-xl text-dim active:text-ink" onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

export function TopBar({ title, back, right }: { title: string; back?: () => void; right?: ReactNode }) {
  return (
    <div className="safe-top sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-bg/90 px-4 pb-3 backdrop-blur">
      {back && (
        <button onClick={back} className="-ml-1 rounded-full p-1.5 text-dim active:text-ink" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h1 className="font-display flex-1 truncate text-xl font-bold">{title}</h1>
      {right}
    </div>
  );
}
