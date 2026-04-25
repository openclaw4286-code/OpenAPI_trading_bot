import { forwardRef, useState } from 'react';

const FormInput = forwardRef(function FormInput({ style, onFocus, onBlur, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      ref={ref}
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      className="w-full rounded-md border px-3.5 outline-none"
      style={{
        height: 44,
        fontSize: 15,
        lineHeight: '20px',
        fontWeight: 400,
        background: 'var(--surface)',
        color: 'var(--text-primary)',
        borderColor: focused ? 'var(--border-focus)' : 'var(--border-default)',
        boxShadow: focused ? '0 0 0 3px var(--accent-brand-soft)' : 'none',
        transition:
          'border-color 160ms var(--ease-soft), box-shadow 160ms var(--ease-soft)',
        ...style,
      }}
    />
  );
});

export default FormInput;
