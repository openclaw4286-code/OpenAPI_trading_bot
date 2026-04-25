import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { MAX_SIZE, formatBytes } from '../lib/files.js';

export default function FileDropzone({ onFiles, disabled = false, compact = false }) {
  const [hover, setHover] = useState(false);
  const inputRef = useRef(null);

  const accept = (files) => {
    if (!files || !files.length || disabled) return;
    onFiles(Array.from(files));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!hover) setHover(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setHover(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        accept(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center outline-none ${
        compact ? 'px-5 py-5' : 'px-6 py-10'
      }`}
      style={{
        borderColor: hover ? 'var(--border-focus)' : 'var(--border-default)',
        background: hover ? 'var(--accent-brand-soft)' : 'var(--surface-layered)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition:
          'background 160ms var(--ease-soft), border-color 160ms var(--ease-soft)',
      }}
    >
      <UploadCloud
        size={compact ? 22 : 28}
        strokeWidth={1.5}
        style={{ color: hover ? 'var(--accent-brand)' : 'var(--text-tertiary)' }}
      />
      <div
        className={compact ? 't-label' : 't-body2'}
        style={{ color: 'var(--text-primary)', fontWeight: 500 }}
      >
        {hover ? '여기에 놓으세요' : '파일을 드래그하거나 클릭해 업로드'}
      </div>
      <div className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
        최대 {formatBytes(MAX_SIZE)} · 여러 개 선택 가능
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
