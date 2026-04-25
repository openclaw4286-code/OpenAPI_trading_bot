import { NavLink } from 'react-router-dom';
import { Home, LineChart, Bell, FlaskConical, Settings } from 'lucide-react';

// Mobile bottom-tab nav. Five fixed slots, each routed via react-router.
// Active state uses the brand accent token; inactive uses tertiary text.
// Sits at the bottom of the AppShell with a safe-area inset on iOS.

const TABS = [
  { to: '/',          label: '홈',       icon: Home },
  { to: '/positions', label: '포지션',   icon: LineChart },
  { to: '/signals',   label: '신호',     icon: Bell },
  { to: '/backtest',  label: '백테',     icon: FlaskConical },
  { to: '/settings',  label: '설정',     icon: Settings },
];

export default function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 z-30 grid grid-cols-5 border-t"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className="flex flex-col items-center justify-center gap-1 py-2.5"
          style={({ isActive }) => ({
            color: isActive ? 'var(--accent-brand)' : 'var(--text-tertiary)',
            transition: 'color var(--dur-fast) var(--ease-soft)',
          })}
        >
          <Icon size={20} strokeWidth={1.75} />
          <span className="t-caption" style={{ fontWeight: 500 }}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
