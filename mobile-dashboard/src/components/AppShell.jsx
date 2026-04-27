import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';

// Mobile-first app shell.
// - max-w-md keeps the layout phone-shaped on tablet/desktop.
// - The scrollable area sits between a fixed-height top spacer and the
//   sticky BottomNav. Each screen renders its own header inside <Outlet />.

export default function AppShell() {
  return (
    <div
      className="mx-auto flex h-full w-full max-w-md flex-col"
      style={{ background: 'var(--background)' }}
    >
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
