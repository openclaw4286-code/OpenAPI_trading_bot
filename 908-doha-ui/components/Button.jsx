import { forwardRef } from 'react';

// Primary affirmative action. Matches docs/button.html — variants +
// sizes + active scale(0.97). Disabled state loses the press animation.

const SIZES = {
  xl: { height: 56, paddingX: 26, fontSize: 16, gap: 10 },
  lg: { height: 48, paddingX: 22, fontSize: 15, gap: 8 },
  md: { height: 40, paddingX: 16, fontSize: 14, gap: 6 },
  sm: { height: 32, paddingX: 12, fontSize: 12, gap: 6 },
};

const VARIANTS = {
  primary: {
    bg: 'var(--accent-brand)',
    hoverBg: 'var(--accent-brand-hover)',
    color: '#FFFFFF',
  },
  secondary: {
    bg: 'var(--surface-layered)',
    hoverBg: 'var(--surface-sunken)',
    color: 'var(--text-primary)',
  },
  ghost: {
    bg: 'transparent',
    hoverBg: 'var(--surface-layered)',
    color: 'var(--accent-brand)',
    border: '1px solid var(--border-default)',
  },
  danger: {
    bg: 'var(--state-negative)',
    hoverBg: 'var(--state-negative)',
    color: '#FFFFFF',
  },
};

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'lg',
    disabled = false,
    type = 'button',
    icon: Icon,
    iconPosition = 'leading',
    children,
    className = '',
    style,
    onMouseEnter,
    onMouseLeave,
    ...rest
  },
  ref,
) {
  const s = SIZES[size] ?? SIZES.lg;
  const v = VARIANTS[variant] ?? VARIANTS.primary;

  const base = disabled
    ? {
        background: 'var(--surface-layered)',
        color: 'var(--text-tertiary)',
        border: v.border ?? 'none',
        cursor: 'not-allowed',
      }
    : {
        background: v.bg,
        color: v.color,
        border: v.border ?? 'none',
        cursor: 'pointer',
      };

  const iconSize = size === 'sm' ? 13 : size === 'md' ? 15 : 16;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = v.hoverBg;
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = v.bg;
        onMouseLeave?.(e);
      }}
      className={`inline-flex items-center justify-center whitespace-nowrap outline-none ${className}`}
      style={{
        height: s.height,
        padding: `0 ${s.paddingX}px`,
        gap: s.gap,
        fontSize: s.fontSize,
        fontWeight: 600,
        letterSpacing: '-0.003em',
        borderRadius: 12,
        transition: 'transform 160ms var(--ease-soft), background 200ms var(--ease-soft)',
        ...base,
        ...style,
      }}
      onPointerDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.97)';
      }}
      onPointerUp={(e) => {
        e.currentTarget.style.transform = '';
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.transform = '';
      }}
      {...rest}
    >
      {Icon && iconPosition === 'leading' && (
        <Icon size={iconSize} strokeWidth={2} />
      )}
      {children}
      {Icon && iconPosition === 'trailing' && (
        <Icon size={iconSize} strokeWidth={2} />
      )}
    </button>
  );
});

export default Button;
