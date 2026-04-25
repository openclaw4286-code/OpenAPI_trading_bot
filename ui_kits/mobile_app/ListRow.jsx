/* 908 Doha · ListRow
 * Benchmarked from Toss Design System (TDS Mobile) — slot-based 3-area layout.
 *
 * <ListRow left={...} contents={...} right={...} withArrow onClick />
 *
 * Sub-components:
 *   ListRow.AssetIcon   — icon with shape (original / squircle / card / circle-bg / circle-mask)
 *   ListRow.AssetImage  — photo/thumbnail with shape
 *   ListRow.AssetText   — label pill (squircle / card) — "오늘", "NEW"
 *   ListRow.IconButton  — right-side button (fill / clear / border)
 *   ListRow.Texts       — typed multi-line text blocks (1RowTypeA etc.)
 *
 * Motion: every row uses --ease-soft; press gives a 0.98 scale + subtle darken.
 */

const { useState } = React;

/* ---- core ListRow ---- */
const ListRow = ({ left, contents, right, withArrow, onClick, disabled }) => {
  const [pressed, setPressed] = useState(false);
  const clickable = !!onClick && !disabled;
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={clickable ? onClick : undefined}
      onPointerDown={() => clickable && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 20px", minHeight: 60,
        background: pressed ? "var(--grey-50)" : "var(--surface)",
        cursor: clickable ? "pointer" : "default",
        transform: pressed ? "scale(0.995)" : "scale(1)",
        transformOrigin: "center",
        transition: "transform .24s var(--ease-soft), background .24s var(--ease-soft)",
        opacity: disabled ? 0.45 : 1,
      }}>
      {left && <div style={{ flexShrink: 0 }}>{left}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>{contents}</div>
      {right && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>{right}</div>}
      {withArrow && (
        <div style={{ flexShrink: 0, color: "var(--text-tertiary)",
          transition: "transform .32s var(--ease-soft)",
          transform: pressed ? "translateX(2px)" : "translateX(0)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      )}
    </div>
  );
};

/* ---- shape → css mapping ---- */
const SHAPE_SIZES = {
  xsmall: 28, small: 36, medium: 44,
};
const shapeStyle = (shape, size = "small") => {
  const px = SHAPE_SIZES[size];
  const base = { width: px, height: px, display: "flex", alignItems: "center",
                 justifyContent: "center", flexShrink: 0, overflow: "hidden" };
  if (shape === "squircle") return { ...base, borderRadius: 12 };
  if (shape === "card")     return { ...base, borderRadius: 8 };
  if (shape === "circle" || shape === "circle-background" || shape === "circle-masking")
    return { ...base, borderRadius: "50%", width: 40, height: 40 };
  if (shape === "square")   return { ...base, borderRadius: 0, width: 52, height: 52 };
  return base; /* original — no frame */
};

/* ---- AssetIcon ----
 * Benchmark: TDS ListRow.AssetIcon — shape/variant/size from a CDN or lucide.
 * We use Lucide names (passed as `icon` — a Lucide component or render prop) so
 * you aren't locked into the Toss icon CDN.
 */
ListRow.AssetIcon = ({ icon, shape = "squircle", size = "small",
                      backgroundColor = "var(--grey-100)", color = "var(--text-primary)",
                      variant = "none" }) => {
  const fill = variant === "fill" ? "var(--accent-brand)" : backgroundColor;
  const tint = variant === "fill" ? "#fff" : color;
  const st = shapeStyle(shape, size);
  return (
    <div style={{ ...st, background: shape === "original" ? "transparent" : fill, color: tint }}>
      {typeof icon === "function" ? icon({ size: Math.round(st.width * 0.55) }) : icon}
    </div>
  );
};

/* ---- AssetImage ---- */
ListRow.AssetImage = ({ src, alt = "", shape = "squircle", size = "small",
                       backgroundColor = "transparent" }) => {
  const st = shapeStyle(shape, size);
  if (shape === "original") {
    return <img src={src} alt={alt} style={{ height: 54, display: "block" }} />;
  }
  return (
    <div style={{ ...st, background: backgroundColor }}>
      <img src={src} alt={alt}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
};

/* ---- AssetText (label pill) ---- */
ListRow.AssetText = ({ children, shape = "squircle", size = "small",
                      backgroundColor = "var(--grey-100)", color = "var(--accent-brand)" }) => {
  const st = shapeStyle(shape, size);
  const fontSize = size === "xsmall" ? 11 : size === "medium" ? 14 : 12;
  return (
    <div style={{ ...st, background: backgroundColor, color,
      fontSize, fontWeight: 600, letterSpacing: "-0.01em" }}>
      {children}
    </div>
  );
};

/* ---- IconButton ---- */
ListRow.IconButton = ({ icon, variant = "clear", iconSize = 18, label, onClick,
                       color = "var(--text-primary)", bgColor = "var(--grey-100)" }) => {
  const [p, setP] = useState(false);
  const variants = {
    fill:   { background: bgColor, border: "none" },
    clear:  { background: "transparent", border: "none" },
    border: { background: "transparent", border: "1px solid var(--border-default)" },
  };
  return (
    <button aria-label={label} onClick={onClick}
      onPointerDown={() => setP(true)} onPointerUp={() => setP(false)} onPointerLeave={() => setP(false)}
      style={{
        width: 32, height: 32, borderRadius: 999, display: "flex",
        alignItems: "center", justifyContent: "center", color, cursor: "pointer",
        fontFamily: "inherit",
        transition: "transform .24s var(--ease-soft), background .24s var(--ease-soft)",
        transform: p ? "scale(0.92)" : "scale(1)", ...variants[variant],
      }}>
      {typeof icon === "function" ? icon({ size: iconSize }) : icon}
    </button>
  );
};

/* ---- Texts ---- */
/* Type system mirrors TDS naming: <rows><Row>Type<A|B|C…> + Right-prefix for alignment. */
const TEXT_TYPES = {
  // LEFT-ALIGNED
  "1RowTypeA": { align: "left", rows: [{ size: 15, weight: 500, color: "--text-primary" }] },
  "1RowTypeB": { align: "left", rows: [{ size: 15, weight: 600, color: "--text-primary" }] },
  "1RowTypeC": { align: "left", rows: [{ size: 17, weight: 600, color: "--text-primary", ls: "-0.01em" }] },

  "2RowTypeA": { align: "left", rows: [
    { size: 15, weight: 500, color: "--text-primary" },
    { size: 13, weight: 500, color: "--text-secondary" }] },
  "2RowTypeB": { align: "left", rows: [
    { size: 13, weight: 500, color: "--text-secondary" },
    { size: 15, weight: 600, color: "--text-primary" }] },
  "2RowTypeC": { align: "left", rows: [
    { size: 17, weight: 600, color: "--text-primary", ls: "-0.01em" },
    { size: 13, weight: 500, color: "--text-secondary" }] },
  "2RowTypeD": { align: "left", rows: [
    { size: 13, weight: 500, color: "--text-secondary" },
    { size: 17, weight: 700, color: "--text-primary", ls: "-0.015em" }] },

  "3RowTypeA": { align: "left", rows: [
    { size: 15, weight: 500, color: "--text-primary" },
    { size: 13, weight: 500, color: "--text-secondary" },
    { size: 12, weight: 500, color: "--text-tertiary" }] },
  "3RowTypeC": { align: "left", rows: [
    { size: 17, weight: 600, color: "--text-primary", ls: "-0.01em" },
    { size: 13, weight: 500, color: "--text-secondary" },
    { size: 12, weight: 500, color: "--text-tertiary" }] },

  // RIGHT-ALIGNED
  "Right1RowTypeA": { align: "right", rows: [{ size: 15, weight: 500, color: "--text-primary" }] },
  "Right1RowTypeB": { align: "right", rows: [{ size: 15, weight: 700, color: "--text-primary", ls: "-0.01em" }] },
  "Right1RowTypeE": { align: "right", rows: [{ size: 13, weight: 500, color: "--text-tertiary" }] },
  "Right2RowTypeA": { align: "right", rows: [
    { size: 15, weight: 700, color: "--text-primary", ls: "-0.01em" },
    { size: 12, weight: 500, color: "--text-tertiary" }] },
  "Right2RowTypeD": { align: "right", rows: [
    { size: 15, weight: 700, color: "--accent-brand", ls: "-0.01em" },
    { size: 12, weight: 500, color: "--text-tertiary" }] },
};

ListRow.Texts = ({ type = "1RowTypeA", top, middle, bottom }) => {
  const cfg = TEXT_TYPES[type] || TEXT_TYPES["1RowTypeA"];
  const values = [top, middle, bottom].filter(v => v !== undefined && v !== null);
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 2,
      alignItems: cfg.align === "right" ? "flex-end" : "flex-start",
      textAlign: cfg.align,
    }}>
      {values.map((v, i) => {
        const row = cfg.rows[i] || cfg.rows[cfg.rows.length - 1];
        return (
          <div key={i} style={{
            fontSize: row.size, fontWeight: row.weight,
            color: `var(${row.color})`, letterSpacing: row.ls || "-0.003em",
            lineHeight: 1.35, fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
          }}>{v}</div>
        );
      })}
    </div>
  );
};

/* ---- List wrapper (dividers / stacking) ---- */
const List = ({ children, dividers = false }) => (
  <div style={{ background: "var(--surface)" }}>
    {React.Children.map(children, (c, i) => (
      <React.Fragment key={i}>
        {i > 0 && dividers && (
          <div style={{ height: 1, background: "var(--border-subtle)", marginLeft: 20 }} />
        )}
        {c}
      </React.Fragment>
    ))}
  </div>
);

/* Export globals */
Object.assign(window, { ListRow, List });
