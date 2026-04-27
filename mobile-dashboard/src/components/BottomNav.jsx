import { NavLink } from 'react-router-dom';
import { Home, LineChart, Bell, FlaskConical, Settings } from 'lucide-react';

/**
 * Bottom tab nav, Toss flavor: active item gets a subtle pill
 * background + brand colour, inactive sits in tertiary text. Touch
 * targets are 56px tall on top of safe-area inset; icons + labels
 * stay vertically stacked so the tab strip stays readable on
 * narrow phones.
 */
const TABS = [
  { to: '/',          label: '홈',     icon: Home },
  { to: '/positions', label: '포지션', icon: LineChart },
  { to: '/signals',   label: '신호',   icon: Bell },
  { to: '/backtest',  label: '백테',   icon: FlaskConical },
  { to: '/settings',  label: '설정',   icon: Settings },
];

export default function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 z-30 grid grid-cols-5 border-t"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 8,
        paddingRight: 8,
      }}
    >
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className="flex items-center justify-center py-2"
        >
          {({ isActive }) => (
            <span
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5"
              style={{
                background: isActive ? 'var(--accent-brand-soft)' : 'transparent',
                color: isActive ? 'var(--accent-brand)' : 'var(--text-tertiary)',
                transition:
                  'background 200ms cubic-bezier(0.32, 0.72, 0, 1), color 160ms cubic-bezier(0.32, 0.72, 0, 1)',
                minWidth: 56,
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
              <span
                className="t-caption"
                style={{
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 11,
                  lineHeight: 1.2,
                }}
              >
                {label}
              </span>
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
