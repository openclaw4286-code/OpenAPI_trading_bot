import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import IconButton from '@ds/components/IconButton.jsx';

// Reusable per-screen top bar. Title + optional back button + optional
// trailing slot (e.g. filter button, clock badge).

export default function ScreenHeader({ title, back = false, trailing = null }) {
  const navigate = useNavigate();
  return (
    <header
      className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b px-3"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border-subtle)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {back ? (
        <IconButton
          icon={ChevronLeft}
          variant="clear"
          size="md"
          ariaLabel="뒤로"
          onClick={() => navigate(-1)}
        />
      ) : (
        <div style={{ width: 36 }} />
      )}
      <h1 className="t-heading1 flex-1 truncate">{title}</h1>
      <div className="flex items-center gap-1">{trailing}</div>
    </header>
  );
}
