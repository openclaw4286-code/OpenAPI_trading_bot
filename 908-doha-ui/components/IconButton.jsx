import { forwardRef } from 'react';

// Icon-only pressable. Matches docs/icon-button.html — 44px default
// with variant tones. `size` is the outer square, icon sizes follow.

const SIZES = { sm: 32, md: 36, lg: 44 };

const VARIANTS = {
  clear: {
    bg: 'transparent',
    hoverBg: 'var(--surface-layered)',
    color: 'var(--text-primary)',
  },
  fill: {
    bg: 'var(--surface-layered)',
    hoverBg: 'var(--surface-sunken)',
    color: 'var(--text-primary)',
  },
  border: {
    bg: 'transparent',
    hoverBg: 'var(--surface-layered)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-default)',
  },
  brand: {
    bg: 'var(--accent-brand)',
    hoverBg: 'var(--accent-brand-hover)',
    color: '#FFFFFF',
  },
  danger: {
    bg: 'transparent',
    hoverBg: 'var(--state-negative-soft)',
    color: 'var(--state-negative)',
  },
};

const IconButton = forwardRef(function IconButton(
  {
    icon: Icon,
    size = 'md',
    variant = 'clear',
    disabled = false,
    type = 'button',
    ariaLabel,
    className = '',
    style,
    onMouseEnter,
    onMouseLeave,
    ...rest
  },
  ref,
) {
  const dim = SIZES[size] ?? SIZES.md;
  const v = VARIANTS[variant] ?? VARIANTS.clear;
  const iconSize = size === 'sm' ? 14 : size === 'md' ? 16 : 18;

  return (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = v.hoverBg;
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = v.bg;
        onMouseLeave?.(e);
      }}
      onPointerDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.92)';
      }}
      onPointerUp={(e) => {
        e.currentTarget.style.transform = '';
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.transform = '';
      }}
      className={`inline-flex items-center justify-center outline-none ${className}`}
      style={{
        width: dim,
        height: dim,
        background: v.bg,
        color: v.color,
        border: v.border ?? 'none',
        borderRadius: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 160ms var(--ease-soft), background 200ms var(--ease-soft)',
        ...style,
      }}
      {...rest}
    >
      {Icon && <Icon size={iconSize} strokeWidth={1.75} />}
    </button>
  );
});

export default IconButton;
