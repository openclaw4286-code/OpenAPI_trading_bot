import {
  Download,
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileCode2,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import MemberAvatar from './MemberAvatar.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useViewport } from '../contexts/ViewportContext.jsx';
import { dataUrl, downloadFile, formatBytes } from '../lib/files.js';

function iconFor(mime) {
  if (!mime) return FileIcon;
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime.startsWith('video/')) return FileVideo;
  if (mime.startsWith('audio/')) return FileAudio;
  if (mime.startsWith('text/') || mime === 'application/pdf') return FileText;
  if (/(zip|tar|gzip|x-7z|rar)/i.test(mime)) return FileArchive;
  if (/(json|javascript|typescript|xml|html|css)/i.test(mime)) return FileCode2;
  return FileIcon;
}

export default function FileCard({ file, onRemove }) {
  const { members } = useAuth();
  const { canMutateFiles } = useViewport();
  const readOnly = !canMutateFiles;
  const uploader = members.find((m) => m.id === file.uploaderId);
  const isImage = file.mimeType?.startsWith('image/');
  const Icon = iconFor(file.mimeType);
  const when = new Date(file.uploadedAt);
  const dateLabel = `${when.getMonth() + 1}/${when.getDate()}`;

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-xl border"
      style={{
        borderColor: 'var(--border-subtle)',
        background: 'var(--surface)',
        boxShadow: 'var(--elev-1)',
        transition: 'box-shadow 160ms var(--ease-soft), transform 160ms var(--ease-soft)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--elev-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--elev-1)';
      }}
    >
      <div
        className="flex aspect-[4/3] items-center justify-center overflow-hidden"
        style={{ background: 'var(--surface-layered)' }}
      >
        {isImage ? (
          <img
            src={dataUrl(file)}
            alt={file.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Icon size={44} strokeWidth={1.25} style={{ color: 'var(--text-tertiary)' }} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div
          className="t-body2 truncate"
          style={{ fontWeight: 500, color: 'var(--text-primary)' }}
          title={file.name}
        >
          {file.name}
        </div>
        <div
          className="flex items-center justify-between t-caption"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <span>
            {formatBytes(file.size)} · {dateLabel}
          </span>
          {uploader && <MemberAvatar member={uploader} size={16} />}
        </div>

        <div className="mt-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            onClick={() => downloadFile(file)}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md t-label"
            style={{
              background: 'var(--surface-layered)',
              color: 'var(--text-primary)',
              transition: 'background 160ms var(--ease-soft)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-sunken)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-layered)')}
            aria-label={`${file.name} 다운로드`}
          >
            <Download size={13} strokeWidth={1.75} />
            다운로드
          </button>
          {!readOnly && (
            <button
              onClick={() => onRemove?.(file)}
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{
                background: 'var(--surface-layered)',
                color: 'var(--state-negative)',
                transition: 'background 160ms var(--ease-soft)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--state-negative-soft)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-layered)')}
              aria-label={`${file.name} 삭제`}
            >
              <Trash2 size={13} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
