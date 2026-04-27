import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Section header with optional count chip + trailing action link.
 * Sits between hero/banner cards and a card list. Title is t-heading2
 * weight (16px / 600), count is a brand-soft chip, action is a
 * tertiary link with chevron — same pattern Toss uses across the app.
 */
export default function SectionHeader({ title, count, actionTo, actionLabel = '모두 보기', icon: Icon }) {
  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        {Icon && (
          <Icon
            size={16}
            strokeWidth={2}
            style={{ color: 'var(--text-secondary)' }}
          />
        )}
        <h3 className="t-heading2" style={{ fontWeight: 700, letterSpacing: '-0.005em' }}>
          {title}
        </h3>
        {count != null && (
          <span
            className="t-caption num-mono inline-flex items-center justify-center rounded-full px-1.5 py-0.5"
            style={{
              minWidth: 18,
              background: 'var(--accent-brand-soft)',
              color: 'var(--accent-brand)',
              fontWeight: 700,
              fontSize: 11,
              lineHeight: 1,
            }}
          >
            {count}
          </span>
        )}
      </div>
      {actionTo && (
        <Link
          to={actionTo}
          className="t-caption inline-flex items-center gap-0.5"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}
        >
          {actionLabel}
          <ChevronRight size={13} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
