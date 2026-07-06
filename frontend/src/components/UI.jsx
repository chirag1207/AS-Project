import s from "./UI.module.css";

export function Card({ children, className = "", style }) {
  return <div className={`${s.card} ${className}`} style={style}>{children}</div>;
}

export function Badge({ children, color = "blue" }) {
  const colors = {
    blue: { bg: "var(--blue-dim)", text: "var(--blue)", border: "rgba(88,166,255,.25)" },
    green:{ bg: "var(--green-dim)",text: "var(--green)",border: "rgba(63,185,80,.25)" },
    red:  { bg: "var(--red-dim)",  text: "var(--red)",  border: "rgba(248,81,73,.25)" },
    orange:{bg:"var(--accent-dim)",text:"var(--accent)",border:"rgba(249,115,22,.25)"},
    purple:{bg:"var(--purple-dim)",text:"var(--purple)",border:"rgba(188,140,255,.25)"},
    gray: { bg: "rgba(139,148,158,.1)", text: "var(--text-muted)", border: "rgba(139,148,158,.2)" },
  };
  const c = colors[color] || colors.blue;
  return (
    <span className={s.badge} style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {children}
    </span>
  );
}

export function FlightCatBadge({ cat }) {
  const map = { VFR:"green", MVFR:"blue", IFR:"red", LIFR:"purple", UNKNOWN:"gray" };
  return <Badge color={map[cat] || "gray"}>{cat || "UNKN"}</Badge>;
}

export function Spinner({ size = 20 }) {
  return (
    <div style={{
      width: size, height: size, border: "2px solid var(--border2)",
      borderTopColor: "var(--accent)", borderRadius: "50%",
      animation: "spin .7s linear infinite", display: "inline-block",
    }} />
  );
}

export function StatRow({ label, value, mono, highlight }) {
  return (
    <div className={s.statRow}>
      <span className={s.statLabel}>{label}</span>
      <span className={`${s.statValue} ${mono ? s.mono : ""} ${highlight ? s.highlight : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

export function SectionHeader({ title, sub }) {
  return (
    <div className={s.sectionHeader}>
      <span className={s.sectionTitle}>{title}</span>
      {sub && <span className={s.sectionSub}>{sub}</span>}
    </div>
  );
}

export function Input({ label, ...props }) {
  return (
    <label className={s.inputWrap}>
      {label && <span className={s.inputLabel}>{label}</span>}
      <input className={s.input} {...props} />
    </label>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <label className={s.inputWrap}>
      {label && <span className={s.inputLabel}>{label}</span>}
      <select className={s.select} {...props}>{children}</select>
    </label>
  );
}

export function Button({ children, variant = "primary", loading, ...props }) {
  return (
    <button className={`${s.btn} ${s[variant]}`} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner size={14} /> : children}
    </button>
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return <div className={s.errorBox}>⚠ {message}</div>;
}

export function StatusDot({ ok }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: ok ? "var(--green)" : "var(--red)",
      boxShadow: `0 0 6px ${ok ? "var(--green)" : "var(--red)"}`,
      marginRight: 6,
    }} />
  );
}
