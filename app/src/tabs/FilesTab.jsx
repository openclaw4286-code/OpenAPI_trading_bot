import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import FileDropzone from '../components/FileDropzone.jsx';
import FileCard from '../components/FileCard.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useViewport } from '../contexts/ViewportContext.jsx';
import { formatBytes, listFiles, removeFile, uploadFile } from '../lib/files.js';

export default function FilesTab() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const { canMutateFiles } = useViewport();
  const readOnly = !canMutateFiles;
  const [files, setFiles] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setFiles(await listFiles());
      } catch (e) {
        toast.error(`불러오기 실패: ${e.message ?? e}`);
      } finally {
        setLoaded(true);
      }
    })();
    // intentionally only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFiles = async (list) => {
    setUploading(list.length);
    let ok = 0;
    for (const f of list) {
      try {
        const saved = await uploadFile(f, { uploaderId: currentUser?.id ?? null });
        setFiles((s) => [saved, ...s]);
        ok += 1;
      } catch (e) {
        toast.error(`${f.name} · ${e.message ?? e}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (ok === 1) toast.success('파일을 올렸어요');
    else if (ok > 1) toast.success(`${ok}개 파일을 올렸어요`);
  };

  const remove = async (file) => {
    const prev = files;
    setFiles(files.filter((f) => f.id !== file.id));
    try {
      await removeFile(file.id);
      toast.success('파일을 삭제했어요');
    } catch (e) {
      setFiles(prev);
      toast.error(`삭제 실패: ${e.message ?? e}`);
    }
  };

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-5 sm:py-6">
      {!readOnly && <FileDropzone onFiles={onFiles} disabled={uploading > 0} />}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 t-caption" style={{ color: 'var(--text-tertiary)' }}>
          {uploading > 0 && (
            <>
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
              <span>업로드 중… ({uploading})</span>
            </>
          )}
        </div>
        <span className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
          {files.length}개 · {formatBytes(totalSize)}
        </span>
      </div>

      {!loaded && (
        <FileGridSkeleton count={8} />
      )}

      {loaded && files.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {files.map((f) => (
            <FileCard key={f.id} file={f} onRemove={remove} />
          ))}
        </div>
      )}

      {loaded && files.length === 0 && uploading === 0 && (
        <div
          className="mx-auto mt-8 max-w-md rounded-xl border border-dashed p-8 text-center"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          <div className="t-heading2" style={{ color: 'var(--text-primary)' }}>
            아직 올라온 파일이 없어요
          </div>
          <p className="t-body2 mt-1.5">위 영역에 파일을 끌어다 놓으면 바로 올라가요.</p>
        </div>
      )}
    </div>
  );
}

function FileGridSkeleton({ count = 8 }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <article
          key={i}
          className="flex flex-col overflow-hidden rounded-xl border"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <Skeleton
            width="100%"
            height={0}
            rounded={0}
            style={{ aspectRatio: '4 / 3' }}
          />
          <div className="flex flex-col gap-1 p-3">
            <Skeleton width="80%" height={14} />
            <div className="mt-1 flex items-center justify-between">
              <Skeleton width={56} height={10} />
              <Skeleton width={16} height={16} circle />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
