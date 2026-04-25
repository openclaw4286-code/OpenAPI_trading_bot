import { useEffect, useState } from 'react';
import { LayoutGrid, Menu, NotebookPen, Paperclip, Lock, Plus, Search, Settings, LogOut, Users } from 'lucide-react';
import BoardTab from './tabs/BoardTab.jsx';
import NotesTab from './tabs/NotesTab.jsx';
import FilesTab from './tabs/FilesTab.jsx';
import VaultTab from './tabs/VaultTab.jsx';
import TeamTab from './tabs/TeamTab.jsx';
import SettingsTab from './tabs/SettingsTab.jsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { NotesProvider } from './contexts/NotesContext.jsx';
import { ViewportProvider, useViewport } from './contexts/ViewportContext.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import FirstRunSetup from './components/FirstRunSetup.jsx';
import MemberAvatar from './components/MemberAvatar.jsx';
import FolderSidebar from './components/FolderSidebar.jsx';
import Button from './components/Button.jsx';
import IconButton from './components/IconButton.jsx';
import Skeleton from './components/Skeleton.jsx';

const TABS = [
  { id: 'board', label: 'Board', icon: LayoutGrid, Component: BoardTab },
  { id: 'notes', label: 'Notes', icon: NotebookPen, Component: NotesTab },
  { id: 'files', label: 'Files', icon: Paperclip, Component: FilesTab },
  { id: 'vault', label: 'Vault', icon: Lock, Component: VaultTab },
];

export default function App() {
  return (
    <ViewportProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ToastProvider>
    </ViewportProvider>
  );
}

function AuthGate() {
  const { currentUser, members, loading, error } = useAuth();

  if (loading) {
    return <BootSkeleton />;
  }

  if (error) {
    return (
      <div className="flex min-h-full items-center justify-center px-6">
        <div
          className="max-w-md rounded-lg px-4 py-3 t-body2"
          style={{ background: 'var(--state-negative-soft)', color: 'var(--state-negative)' }}
        >
          연결 실패: {error}
        </div>
      </div>
    );
  }

  if (members.length === 0) return <FirstRunSetup />;
  if (!currentUser) return <LoginScreen />;
  return (
    <NotesProvider>
      <Shell />
    </NotesProvider>
  );
}

const BOTTOM_TABS = [
  { id: 'team', label: '팀', icon: Users, Component: TeamTab },
  { id: 'settings', label: '설정', icon: Settings, Component: SettingsTab },
];

function Shell() {
  const { currentUser, logout } = useAuth();
  const { isMobile, canMutateTasks, canMutateNotes } = useViewport();
  const [active, setActive] = useState('board');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isBottom = BOTTOM_TABS.some((t) => t.id === active);
  const current = isBottom
    ? BOTTOM_TABS.find((t) => t.id === active)
    : TABS.find((t) => t.id === active);
  const Current = current.Component;
  const isSettings = active === 'settings';

  // close the drawer when the viewport grows out of mobile
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  // close drawer after picking a tab on mobile
  const pickTab = (id) => {
    setActive(id);
    if (isMobile) setDrawerOpen(false);
  };

  return (
    <div className="flex h-full">
      {isMobile && drawerOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'var(--overlay-dim)' }}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={`flex w-56 shrink-0 flex-col border-r ${
          isMobile ? 'fixed inset-y-0 left-0 z-50' : ''
        }`}
        style={{
          borderColor: 'var(--border-subtle)',
          background: 'var(--surface-layered)',
          transform: isMobile && !drawerOpen ? 'translateX(-100%)' : 'translateX(0)',
          transition: isMobile ? 'transform 220ms var(--ease-emphasis)' : 'none',
        }}
      >
        <div
          className="flex h-14 items-center px-5 t-heading1"
          style={{ letterSpacing: '-0.01em' }}
        >
          908doha{' '}
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 6 }}>
            Workspace
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {TABS.map(({ id, label, icon: Icon }) => {
            const on = active === id;
            return (
              <button
                key={id}
                onClick={() => pickTab(id)}
                className="flex h-9 items-center gap-2.5 rounded-md px-3 t-label"
                style={{
                  background: on ? 'var(--accent-brand-soft)' : 'transparent',
                  color: on ? 'var(--text-brand)' : 'var(--text-secondary)',
                  transition: 'background 160ms var(--ease-soft), color 160ms var(--ease-soft)',
                }}
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
          <div className="mt-auto flex flex-col gap-0.5 pb-2">
            {BOTTOM_TABS.map(({ id, label, icon: Icon }) => {
              const on = active === id;
              return (
                <button
                  key={id}
                  onClick={() => pickTab(id)}
                  className="flex h-9 items-center gap-2.5 rounded-md px-3 t-label"
                  style={{
                    background: on ? 'var(--accent-brand-soft)' : 'transparent',
                    color: on ? 'var(--text-brand)' : 'var(--text-secondary)',
                    transition: 'background 160ms var(--ease-soft), color 160ms var(--ease-soft)',
                  }}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>
        {currentUser && (
          <div
            className="flex items-center gap-2.5 border-t px-3 py-3"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <MemberAvatar member={currentUser} size={28} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="t-label truncate" style={{ color: 'var(--text-primary)' }}>
                {currentUser.name}
              </span>
            </div>
            <button
              onClick={logout}
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Logout"
              title="로그아웃"
            >
              <LogOut size={15} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </aside>

      {active === 'notes' && !isMobile && <FolderSidebar />}

      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <header
          className="sticky top-0 z-20 flex h-14 items-center gap-3 px-5"
          style={{
            background: 'var(--surface-glass)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {isMobile && (
            <IconButton
              icon={Menu}
              size="md"
              variant="clear"
              ariaLabel="메뉴"
              onClick={() => setDrawerOpen(true)}
            />
          )}
          {active !== 'notes' && <div className="t-heading1">{current.label}</div>}
          {!isBottom && (
            <div className="ml-auto flex items-center gap-2">
              <IconButton
                icon={Search}
                size="md"
                variant="clear"
                ariaLabel="Search"
              />
              {((active === 'board' && canMutateTasks) ||
                (active === 'notes' && canMutateNotes)) && (
                <Button
                  variant="primary"
                  size="md"
                  icon={Plus}
                  onClick={() => {
                    const evt =
                      active === 'notes' ? 'workspace:new-note' : 'workspace:new-task';
                    window.dispatchEvent(new CustomEvent(evt));
                  }}
                >
                  New
                </Button>
              )}
            </div>
          )}
        </header>
        <div className="flex-1">
          <Current />
        </div>
      </main>
    </div>
  );
}

function BootSkeleton() {
  return (
    <div className="flex h-full">
      <aside
        className="hidden w-56 shrink-0 flex-col gap-2 border-r p-3 md:flex"
        style={{
          borderColor: 'var(--border-subtle)',
          background: 'var(--surface-layered)',
        }}
      >
        <div className="px-2 pb-3 pt-1">
          <Skeleton width={120} height={18} />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={32} rounded={8} />
        ))}
      </aside>
      <main className="flex flex-1 flex-col">
        <header
          className="flex h-14 items-center gap-3 px-5"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <Skeleton width={88} height={20} />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton width={36} height={36} rounded={10} />
            <Skeleton width={72} height={36} rounded={10} />
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-5 py-6">
          <Skeleton width={160} height={22} />
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <article
                key={i}
                className="rounded-xl border p-4"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <Skeleton width="70%" height={14} />
                <Skeleton width="100%" height={12} style={{ marginTop: 10 }} />
                <Skeleton width="55%" height={12} style={{ marginTop: 6 }} />
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
