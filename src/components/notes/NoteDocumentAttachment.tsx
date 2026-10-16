import React, { useEffect, useState } from 'react';
import { mdiDownload, mdiFileDocumentOutline } from '@mdi/js';
import { apiClient } from '../../services/apiClient';
import type { IAttachment } from '../../types/models';

export const NoteDocumentAttachment: React.FC<{ attachment: IAttachment; url: string }> = ({ attachment, url }) => {
  const [localUrl, setLocalUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; let ownedUrl = '';
    setLocalUrl('');
    void caches.open('note-downloaded-files').then(cache => cache.match(url)).then(async response => {
      if (!response || !active) return;
      const blob = await response.blob();
      if (!active) return;
      ownedUrl = URL.createObjectURL(blob); setLocalUrl(ownedUrl);
    }).catch(() => {});
    return () => { active = false; if (ownedUrl) URL.revokeObjectURL(ownedUrl); };
  }, [url]);
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
  const activate = async () => {
    if (localUrl) { window.open(localUrl, '_blank', 'noopener'); return; }
    setBusy(true); setError('');
    try {
      const response = await apiClient.get<Blob>(url, { responseType: 'blob' });
      const blob = response.data;
      await caches.open('note-downloaded-files').then(cache => cache.put(url, new Response(blob))).catch(() => {});
      const downloaded = URL.createObjectURL(blob); setLocalUrl(downloaded);
      const link = document.createElement('a'); link.href = downloaded; link.download = attachment.fileName; link.click();
    } catch { setError('Не удалось скачать файл. Повторите попытку.'); }
    finally { setBusy(false); }
  };
  return <div>
    <button onClick={() => void activate()} disabled={busy} aria-label={localUrl ? 'Открыть файл' : 'Скачать файл'} title={localUrl ? 'Открыть файл' : 'Скачать файл'} style={{ color: 'var(--text-body, #FFFFFF)', background: 'transparent', border: 0, cursor: 'pointer', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, textAlign: 'left' }}>
      <span style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: 'var(--surface-hover, rgba(255,255,255,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor"><path d={localUrl ? mdiFileDocumentOutline : mdiDownload}/></svg></span>
      <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.fileName}</span><small style={{ display: 'block', opacity: 0.7, marginTop: 3 }}>{busy ? 'Скачивание…' : attachment.fileSizeStr}</small></span>
    </button>
    {error && <small role="alert">{error}</small>}
  </div>;
};

