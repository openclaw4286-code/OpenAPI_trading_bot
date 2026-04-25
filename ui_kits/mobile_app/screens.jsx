const { useState } = React;

/* ============== Screens for the 908 Doha app prototype ============== */

/* ---------- Shared bits ---------- */
const MerchantIcon = ({ name, color = "var(--accent-brand)", bg = "var(--primary-50)" }) => (
  <div style={{
    width: 40, height: 40, borderRadius: 12, background: bg, color,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
  }}><Icon name={name} size={20} /></div>
);
const Money = ({ value, neg, pos }) => (
  <div style={{
    fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500,
    color: neg ? "var(--state-negative)" : pos ? "var(--state-positive)" : "var(--text-primary)"
  }}>{neg ? "−" : pos ? "+" : ""}{value}</div>
);

/* Animated balance — interpolates over 720ms with ease-soft */
const AnimatedBalance = ({ value, onClick }) => {
  const [display, setDisplay] = React.useState(value);
  const prev = React.useRef(value);
  React.useEffect(() => {
    const from = prev.current, to = value, dur = 720, t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      setDisplay(from + (to - from) * ease(k));
      if (k < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <div onClick={onClick} style={{
      fontFamily: "var(--font-sans)", fontSize: 38, fontWeight: 700,
      letterSpacing: "-0.02em", color: "var(--text-primary)", cursor: "pointer",
      display: "flex", alignItems: "baseline", gap: 8, fontVariantNumeric: "tabular-nums"
    }}>
      {display.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-tertiary)" }}>QAR</span>
    </div>
  );
};

/* ---------- HOME ---------- */
const HomeScreen = ({ balance, onSend, onAccount, onAddCard, transfersDone }) => (
  <div style={{ flex: 1, overflow: "auto", background: "var(--background)" }}>
    {/* Header */}
    <div style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", background: "var(--accent-brand)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
        fontWeight: 700, fontSize: 13, letterSpacing: "-0.5px"
      }}>LA</div>
      <div style={{ display: "flex", gap: 4 }}>
        <button style={{ background: "transparent", border: 0, padding: 8, cursor: "pointer", color: "var(--text-primary)" }}>
          <Icon name="qr" size={22} /></button>
        <button style={{ background: "transparent", border: 0, padding: 8, cursor: "pointer", color: "var(--text-primary)" }}>
          <Icon name="bell" size={22} /></button>
      </div>
    </div>

    {/* Greeting + balance — animated number */}
    <div style={{ padding: "20px 20px 8px" }}>{(() => null)()}
      <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>Good evening, Laila</div>
      <AnimatedBalance value={balance} onClick={onAccount} />
      <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
        {transfersDone > 0 ? `+${(500 * transfersDone).toLocaleString("en")} sent today` : "Main account · QA91 DOHB 0908"}
      </div>
    </div>

    {/* Quick actions */}
    <div style={{ padding: "20px 20px 0", display: "flex", gap: 10 }}>
      {[
        { ico: "send", label: "Send", on: onSend },
        { ico: "arrowDownLeft", label: "Receive" },
        { ico: "card", label: "Cards", on: onAddCard },
        { ico: "piggy", label: "Saving" },
      ].map((a, i) => (
        <button key={i} onClick={a.on} style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          padding: "14px 6px", background: "var(--surface)", border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)", cursor: "pointer", fontFamily: "inherit"
        }}>
          <div style={{ color: "var(--accent-brand)" }}><Icon name={a.ico} size={22} /></div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{a.label}</div>
        </button>
      ))}
    </div>

    {/* Insight card */}
    <div style={{ padding: "20px 20px 0" }}>
      <div style={{
        background: "var(--surface)", borderRadius: "var(--radius-xl)",
        padding: 18, border: "1px solid var(--border-subtle)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>This month</div>
          <Badge variant="soft" tone="positive">−12% vs Oct</Badge>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 56, marginBottom: 10 }}>
          {[40, 65, 38, 80, 50, 72, 44, 58, 68, 34].map((h, i) => (
            <div key={i} style={{
              flex: 1, height: `${h}%`, background: i === 7 ? "var(--accent-brand)" : "var(--grey-200)",
              borderRadius: 3
            }} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>You've spent 3,280 QAR this month</div>
      </div>
    </div>

    {/* Recent activity */}
    <div style={{ padding: "24px 0 20px" }}>
      <div style={{ padding: "0 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Recent activity</div>
        <div style={{ fontSize: 13, color: "var(--accent-brand)", fontWeight: 500 }}>See all</div>
      </div>
      <ListRow leading={<MerchantIcon name="arrowDownLeft" />}
        title="Laila Al-Khater" desc="Salary · Tue 14 Nov"
        trailing={<Money pos value="8,500.00" />} />
      <ListRow leading={<MerchantIcon name="coffee" color="var(--text-secondary)" bg="var(--grey-100)" />}
        title="Flat White Roasters" desc="Msheireb · today"
        trailing={<Money neg value="32.00" />} />
      <ListRow leading={<MerchantIcon name="fuel" color="var(--text-secondary)" bg="var(--grey-100)" />}
        title="Woqod Station 41" desc="West Bay · today"
        trailing={<Money neg value="180.00" />} />
      <ListRow leading={<MerchantIcon name="shopping" color="var(--text-secondary)" bg="var(--grey-100)" />}
        title="Monoprix Al Waab" desc="yesterday"
        trailing={<Money neg value="284.50" />} />
    </div>
  </div>
);

/* ---------- SEND / CONFIRM ---------- */
const SendScreen = ({ onBack, onConfirm }) => {
  const [amount, setAmount] = useState("500");
  return (
    <>
      <Top title="Send" onBack={onBack} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>To</div>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)", padding: 14, display: "flex",
          gap: 12, alignItems: "center", marginBottom: 20
        }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent-brand)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13 }}>LK</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Laila Al-Khater</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>QA91 DOHB 0908 4321</div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>Amount</div>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)", padding: "18px 16px", display: "flex",
          alignItems: "baseline", gap: 10, marginBottom: 10
        }}>
          <input type="text" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            style={{
              flex: 1, border: 0, outline: 0, background: "transparent",
              fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em",
              fontFamily: "inherit", color: "var(--text-primary)"
            }} />
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-tertiary)" }}>QAR</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[100, 500, 1000].map(v => (
            <button key={v} onClick={() => setAmount(String(v))} style={{
              flex: 1, padding: "8px 12px", background: "var(--grey-100)", border: 0,
              borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: "pointer",
              fontFamily: "inherit", color: "var(--text-primary)"
            }}>+{v}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          Transfers to this account usually arrive in under a minute.
        </div>
      </div>
      <div style={{ padding: "12px 20px 24px", borderTop: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
        <Button onClick={() => onConfirm(Number(amount))} disabled={!amount || Number(amount) === 0}>
          Confirm transfer
        </Button>
      </div>
    </>
  );
};

/* ---------- RESULT ---------- */
const ResultScreen = ({ amount, onDone }) => (
  <>
    <div style={{ flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "40px 40px", textAlign: "center" }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%", background: "var(--accent-brand-soft)",
        color: "var(--accent-brand)", display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 24, animation: "popin .72s var(--ease-soft)"
      }}><Icon name="check" size={36} strokeWidth={2} /></div>
      <style>{`@keyframes popin{from{transform:scale(.5);opacity:0;}to{transform:scale(1);opacity:1;}}`}</style>
      <div style={{
        fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 500,
        letterSpacing: "-0.02em", marginBottom: 8, color: "var(--text-primary)"
      }}>Sent.</div>
      <div style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: "22px", maxWidth: 260 }}>
        {amount.toLocaleString("en")} QAR is on its way to Laila. Arrives in under a minute.
      </div>
    </div>
    <div style={{ padding: "12px 20px 24px" }}>
      <Button onClick={onDone}>Done</Button>
    </div>
  </>
);

/* ---------- SETTINGS ---------- */
const SettingsScreen = ({ onBack, dark, onDark }) => {
  const [notif, setNotif] = useState(true);
  const [biometric, setBiometric] = useState(true);
  return (
    <>
      <Top title="Settings" onBack={onBack} />
      <div style={{ flex: 1, overflow: "auto", background: "var(--background)" }}>
        <div style={{ padding: "20px 20px 8px", fontSize: 12, fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>Appearance</div>
        <div style={{ background: "var(--surface)" }}>
          <ListRow title="Dark mode" desc="Uses your system setting" trailing={<Switch on={dark} onChange={onDark} />} />
        </div>
        <div style={{ padding: "20px 20px 8px", fontSize: 12, fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>Security</div>
        <div style={{ background: "var(--surface)" }}>
          <ListRow title="Face ID" desc="Unlock the app and confirm transfers"
            trailing={<Switch on={biometric} onChange={setBiometric} />} />
          <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
          <ListRow title="Change passcode" trailing={<Icon name="chevronRight" size={18} color="var(--text-tertiary)" />} onClick={() => {}} />
        </div>
        <div style={{ padding: "20px 20px 8px", fontSize: 12, fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>Notifications</div>
        <div style={{ background: "var(--surface)" }}>
          <ListRow title="Push notifications" trailing={<Switch on={notif} onChange={setNotif} />} />
        </div>
      </div>
    </>
  );
};

/* ---------- ADD CARD (Bottom sheet) ---------- */
const AddCardSheet = ({ onClose, onAdd }) => (
  <div style={{
    position: "absolute", inset: 0, background: "var(--overlay-dim)", zIndex: 20,
    display: "flex", alignItems: "flex-end"
  }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{
      width: "100%", background: "var(--surface)",
      borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0",
      padding: "8px 20px 24px", animation: "slide .3s var(--ease-spring)"
    }}>
      <div style={{ width: 36, height: 4, background: "var(--grey-300)",
        borderRadius: 999, margin: "4px auto 16px" }} />
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>Add a new card</div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20, lineHeight: "20px" }}>
        Scan or type your card. Details are stored with bank-grade encryption.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Button onClick={onAdd}>Scan card</Button>
        <Button variant="secondary" onClick={onAdd}>Enter manually</Button>
      </div>
    </div>
    <style>{`@keyframes slide { from { transform: translateY(100%);} to { transform: translateY(0);} }`}</style>
  </div>
);

Object.assign(window, { HomeScreen, SendScreen, ResultScreen, SettingsScreen, AddCardSheet });
