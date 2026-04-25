/* 908 DS Mobile UI Kit Components */

const { useState } = React;

/* ---------------- Icons (inline stroke SVG — Lucide-style) ---------------- */
const Icon = ({ name, size = 20, color = "currentColor", strokeWidth = 1.75 }) => {
  const paths = {
    arrowUpRight: <path d="M7 17L17 7M9 7h8v8" />,
    arrowDownLeft: <path d="M17 7L7 17m8 0H7V9" />,
    chevronRight: <path d="M9 18l6-6-6-6" />,
    chevronLeft: <path d="M15 18l-6-6 6-6" />,
    home: <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />,
    send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />,
    wallet: <><path d="M20 12V8H4v12h16v-4" /><path d="M20 12h-4a2 2 0 0 0 0 4h4v-4z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 18h3M18 14h3" /></>,
    card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
    check: <path d="M5 12l5 5L20 7" />,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    coffee: <><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" /><path d="M6 2v3M10 2v3M14 2v3" /></>,
    fuel: <><path d="M3 22V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v18" /><path d="M2 22h13M14 10h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V8l-3-3" /></>,
    shopping: <><path d="M3 6h18l-2 13H5z" /><path d="M8 6V4a4 4 0 0 1 8 0v2" /></>,
    piggy: <><path d="M19 5c-1.5 0-2.8.4-4 1h-4a7 7 0 0 0-7 7v1a5 5 0 0 0 3 4.5V21h4v-2h2v2h4v-2.5a6.9 6.9 0 0 0 3-5.7V8.5l3-1V5z" /><circle cx="15" cy="11" r="1" fill="currentColor" /></>,
    x: <path d="M18 6L6 18M6 6l12 12" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
};

/* ---------------- Device frame ---------------- */
const Phone = ({ children }) => (
  <div style={{
    width: 375, height: 780, borderRadius: 44, background: "var(--grey-900)",
    padding: 10, boxShadow: "var(--elev-4)", flexShrink: 0
  }}>
    <div style={{
      width: "100%", height: "100%", borderRadius: 36, overflow: "hidden",
      background: "var(--background)", position: "relative", display: "flex", flexDirection: "column"
    }}>
      {/* Status bar */}
      <div style={{
        height: 44, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 22px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flexShrink: 0
      }}>
        <span>9:41</span>
        <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 10 }}>●●●●</span>
          <span style={{ fontSize: 10 }}>⏽</span>
        </span>
      </div>
      {children}
    </div>
  </div>
);

/* ---------------- Top bar ---------------- */
const Top = ({ title, onBack, trailing }) => (
  <div style={{
    display: "flex", alignItems: "center", padding: "10px 8px 10px 16px",
    background: "var(--surface)", borderBottom: "1px solid var(--border-subtle)",
    flexShrink: 0, minHeight: 52
  }}>
    {onBack && (
      <button onClick={onBack} style={{
        background: "transparent", border: 0, padding: 8, cursor: "pointer",
        color: "var(--text-primary)", display: "flex"
      }}><Icon name="chevronLeft" size={22} /></button>
    )}
    <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "var(--text-primary)",
      marginLeft: onBack ? 4 : 4, letterSpacing: "-0.004em" }}>{title}</div>
    {trailing}
  </div>
);

/* ---------------- Button ---------------- */
const Button = ({ variant = "primary", size = "lg", full = true, children, onClick, disabled }) => {
  const base = {
    border: 0, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
    fontWeight: 600, letterSpacing: "-0.003em", transition: "all .15s var(--ease-out)",
    width: full ? "100%" : "auto", borderRadius: "var(--radius-md)"
  };
  const sizes = { lg: { padding: "16px 22px", fontSize: 16 },
                  md: { padding: "12px 18px", fontSize: 14 },
                  sm: { padding: "8px 14px", fontSize: 13 } };
  const [pressed, setPressed] = useState(false);
  const variants = {
    primary: { background: "var(--accent-brand)", color: "#fff" },
    secondary: { background: "var(--grey-100)", color: "var(--text-primary)" },
    tertiary: { background: "transparent", color: "var(--accent-brand)",
                border: "1px solid var(--border-default)" },
    destructive: { background: "var(--state-negative)", color: "#fff" },
  };
  const dis = disabled ? { background: "var(--grey-100)", color: "var(--text-tertiary)" } : {};
  return (
    <button onClick={disabled ? undefined : onClick}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{ ...base, ...sizes[size], ...variants[variant], ...dis,
        transition: "transform .16s var(--ease-soft), background .28s var(--ease-soft)",
        transform: pressed ? "scale(0.97)" : "scale(1)" }}>{children}</button>
  );
};

/* ---------------- ListRow ---------------- */
const ListRow = ({ leading, title, desc, trailing, onClick }) => (
  <div onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
    cursor: onClick ? "pointer" : "default", minHeight: 56
  }}>
    {leading && <div style={{ flexShrink: 0 }}>{leading}</div>}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)",
        letterSpacing: "-0.003em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
      {desc && <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>{desc}</div>}
    </div>
    {trailing && <div style={{ flexShrink: 0 }}>{trailing}</div>}
  </div>
);

/* ---------------- Badge ---------------- */
const Badge = ({ variant = "soft", tone = "brand", children }) => {
  const tones = {
    brand: { soft: ["var(--accent-brand-soft)", "var(--primary-700)"],
             solid: ["var(--accent-brand)", "#fff"] },
    positive: { soft: ["var(--state-positive-soft)", "var(--green-700)"],
                solid: ["var(--state-positive)", "#fff"] },
    negative: { soft: ["var(--state-negative-soft)", "var(--red-700)"],
                solid: ["var(--state-negative)", "#fff"] },
    warning: { soft: ["var(--state-warning-soft)", "var(--orange-700)"],
               solid: ["var(--state-warning)", "#fff"] },
    neutral: { soft: ["var(--grey-100)", "var(--grey-700)"],
               solid: ["var(--grey-700)", "#fff"] },
  };
  const [bg, fg] = tones[tone][variant];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
      borderRadius: 999, fontSize: 12, fontWeight: 600, background: bg, color: fg,
      letterSpacing: "-0.002em"
    }}>{children}</span>
  );
};

/* ---------------- Switch ---------------- */
const Switch = ({ on, onChange }) => (
  <div onClick={() => onChange(!on)} style={{
    width: 48, height: 28, background: on ? "var(--accent-brand)" : "var(--grey-300)",
    borderRadius: 999, position: "relative", cursor: "pointer",
    transition: "background .28s var(--ease-soft)"
  }}>
    <div style={{
      position: "absolute", width: 24, height: 24, background: "#fff", borderRadius: "50%",
      top: 2, left: 2, transform: on ? "translateX(20px)" : "translateX(0)",
      transition: "transform .48s var(--ease-spring)", boxShadow: "0 1px 3px rgba(0,0,0,.15)"
    }} />
  </div>
);

Object.assign(window, { Icon, Phone, Top, Button, ListRow, Badge, Switch });
