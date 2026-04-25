import { forwardRef, useState } from 'react';

const FormTextarea = forwardRef(function FormTextarea(
  { style, rows = 4, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      className="w-full resize-y rounded-md border px-3.5 py-2.5 outline-none"
      style={{
        minHeight: 88,
        fontSize: 15,
        lineHeight: '22px',
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

export default FormTextarea;
