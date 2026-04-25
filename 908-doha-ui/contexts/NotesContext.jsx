import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';
import { emptyNote, listNotes, removeNote, upsertNote } from '../lib/notes.js';
import {
  createFolder as createFolderReq,
  listFolders,
  removeFolder as removeFolderReq,
  renameFolder as renameFolderReq,
} from '../lib/folders.js';

const NotesContext = createContext(null);

const SPECIAL_IDS = new Set(['all', 'pinned', 'unfiled']);

export function NotesProvider({ children }) {
  const { currentUser } = useAuth();
  const toast = useToast();

  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState('all');
  const [openNote, setOpenNote] = useState(null);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [ns, fs] = await Promise.all([listNotes(), listFolders()]);
      setNotes(ns);
      setFolders(fs);
    } catch (e) {
      toast.error(`불러오기 실패: ${e.message ?? e}`);
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const open = () => {
      const folderId = SPECIAL_IDS.has(selected) ? null : selected;
      setOpenNote(emptyNote({ createdBy: currentUser?.id ?? null, folderId }));
    };
    window.addEventListener('workspace:new-note', open);
    return () => window.removeEventListener('workspace:new-note', open);
  }, [currentUser, selected]);

  const filtered = useMemo(() => {
    let list = notes;
    if (selected === 'pinned') list = list.filter((n) => n.pinned);
    else if (selected === 'unfiled') list = list.filter((n) => !n.folderId);
    else if (!SPECIAL_IDS.has(selected)) list = list.filter((n) => n.folderId === selected);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((n) => {
        if (n.title.toLowerCase().includes(q)) return true;
        if ((n.tags ?? []).some((t) => t.toLowerCase().includes(q))) return true;
        return (n.blocks ?? []).some((b) => (b.text ?? '').toLowerCase().includes(q));
      });
    }
    return list;
  }, [notes, selected, query]);

  const folderNameOf = (id) => {
    if (id === 'all') return '모든 노트';
    if (id === 'pinned') return '고정됨';
    if (id === 'unfiled') return '분류 없음';
    return folders.find((f) => f.id === id)?.name ?? '폴더';
  };

  const upsert = async (note) => {
    const idx = notes.findIndex((n) => n.id === note.id);
    const isNew = idx === -1;
    const stamped = {
      ...note,
      createdBy: note.createdBy ?? currentUser?.id ?? null,
      updatedBy: currentUser?.id ?? null,
    };
    const prev = notes;
    setNotes(isNew ? [stamped, ...notes] : notes.map((n) => (n.id === stamped.id ? stamped : n)));
    try {
      const saved = await upsertNote(stamped);
      setNotes((list) => sortNotes(list.map((n) => (n.id === saved.id ? saved : n))));
      toast.success(isNew ? '노트를 만들었어요' : '노트를 저장했어요');
    } catch (e) {
      setNotes(prev);
      toast.error(`저장 실패: ${e.message ?? e}`);
    }
  };

  const remove = async (note) => {
    const prev = notes;
    setNotes(notes.filter((n) => n.id !== note.id));
    setOpenNote(null);
    try {
      await removeNote(note.id);
      toast.success('노트를 삭제했어요');
    } catch (e) {
      setNotes(prev);
      toast.error(`삭제 실패: ${e.message ?? e}`);
    }
  };

  const addFolder = async (name) => {
    try {
      const f = await createFolderReq(name);
      setFolders((list) => [...list, f]);
      toast.success('폴더를 만들었어요');
      setSelected(f.id);
    } catch (e) {
      toast.error(`폴더 생성 실패: ${e.message ?? e}`);
    }
  };

  const renameFolder = async (id, name) => {
    try {
      const updated = await renameFolderReq(id, name);
      setFolders((list) => list.map((f) => (f.id === id ? updated : f)));
    } catch (e) {
      toast.error(`이름 변경 실패: ${e.message ?? e}`);
    }
  };

  const removeFolder = async (id) => {
    const prevFolders = folders;
    const prevNotes = notes;
    setFolders(folders.filter((f) => f.id !== id));
    setNotes(notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)));
    if (selected === id) setSelected('all');
    try {
      await removeFolderReq(id);
      toast.success('폴더를 삭제했어요');
    } catch (e) {
      setFolders(prevFolders);
      setNotes(prevNotes);
      toast.error(`삭제 실패: ${e.message ?? e}`);
    }
  };

  const value = {
    notes,
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
    addFolder,
    renameFolder,
    removeFolder,
  };

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used inside NotesProvider');
  return ctx;
}

export function sortNotes(list) {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt);
  });
}
