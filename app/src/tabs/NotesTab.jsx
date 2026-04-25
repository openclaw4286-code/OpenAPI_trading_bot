import NoteCard from '../components/NoteCard.jsx';
import NotePage from '../components/NotePage.jsx';
import SearchField from '../components/SearchField.jsx';
import FormSelect from '../components/FormSelect.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { sortNotes, useNotes } from '../contexts/NotesContext.jsx';
import { useViewport } from '../contexts/ViewportContext.jsx';

export default function NotesTab() {
  const {
    folders,
    selected,
    setSelected,
    openNote,
    setOpenNote,
    query,
    setQuery,
    loaded,
    filtered,
    folderNameOf,
    upsert,
    remove,
  } = useNotes();
  const { isMobile } = useViewport();

  const folderOptions = [
    { value: 'all', label: '모든 노트' },
    { value: 'pinned', label: '고정됨' },
    { value: 'unfiled', label: '분류 없음' },
    ...folders.map((f) => ({ value: f.id, label: f.name })),
  ];

  if (openNote) {
    return (
      <NotePage
        note={openNote}
        folders={folders}
        folderLabel={folderNameOf(openNote.folderId ?? 'unfiled')}
        onBack={() => setOpenNote(null)}
        onSave={upsert}
        onDelete={remove}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="t-title3">{folderNameOf(selected)}</h2>
        <span className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
          {filtered.length}개
        </span>
      </div>

      {isMobile && (
        <div className="mb-3">
          <FormSelect
            value={selected}
            onChange={setSelected}
            options={folderOptions}
            placeholder="폴더"
          />
        </div>
      )}

      <div className="mb-4">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="제목, 내용, 태그 검색"
          className="w-full"
        />
      </div>

      {!loaded ? (
        <NoteGridSkeleton count={8} />
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortNotes(filtered).map((n) => (
            <NoteCard key={n.id} note={n} onOpen={setOpenNote} />
          ))}
        </div>
      ) : (
        loaded && (
          <div
            className="mx-auto mt-8 max-w-md rounded-xl border border-dashed p-8 text-center"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <div className="t-heading2" style={{ color: 'var(--text-primary)' }}>
              {query ? '일치하는 노트가 없어요' : '아직 노트가 없어요'}
            </div>
            {!query && (
              <p className="t-body2 mt-1.5">상단의 New로 첫 노트를 만들어보세요.</p>
            )}
          </div>
        )
      )}
    </div>
  );
}

function NoteGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <article
          key={i}
          className="flex flex-col rounded-xl border p-4"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <Skeleton width="70%" height={16} />
          <Skeleton width="100%" height={12} style={{ marginTop: 12 }} />
          <Skeleton width="90%" height={12} style={{ marginTop: 6 }} />
          <Skeleton width="60%" height={12} style={{ marginTop: 6 }} />
          <div className="mt-3 flex items-center justify-between">
            <Skeleton width={32} height={10} />
            <Skeleton width={16} height={16} circle />
          </div>
        </article>
      ))}
    </div>
  );
}
