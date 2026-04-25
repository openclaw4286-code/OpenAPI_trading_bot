import { forwardRef, useEffect, useRef } from 'react';

// Borderless textarea that grows to fit its contents. Used inside
// blocks so the editor reads as one flowing document instead of a
// stack of fixed-height boxes.
const AutoTextarea = forwardRef(function AutoTextarea(
  { value, onChange, minRows = 1, className = '', style, onKeyDown, ...rest },
  ref,
) {
  const inner = useRef(null);
  const el = () => (typeof ref === 'function' ? null : ref?.current) ?? inner.current;

  const resize = () => {
    const node = el();
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  };

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={(node) => {
        inner.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      rows={minRows}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      onInput={resize}
      onKeyDown={onKeyDown}
      className={`w-full resize-none bg-transparent outline-none ${className}`}
      style={{
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    />
  );
});

export default AutoTextarea;
