import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '../../services/apiClient';

type Point = { x: number; y: number };
type Stroke = { color: string; width: number; points: Point[] };
type Crop = { x: number; y: number; width: number; height: number };

export function AttachmentMediaEditorView({ file, onClose, onDone }: {
  file: File; onClose: () => void; onDone: (file: File) => Promise<void>;
}) {
  const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
  const isVideo = isGif || file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|wmv)$/i.test(file.name);
  const [url, setUrl] = useState('');
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [mode, setMode] = useState<'draw' | 'crop'>(isVideo ? 'crop' : 'draw');
  const [color, setColor] = useState('#FF3B30');
  const [brush, setBrush] = useState(5);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, width: 1, height: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const drag = useRef<{ start: Point; stroke?: Stroke; handle?: string; original?: Crop } | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const source = URL.createObjectURL(file);
    setUrl(source);
    return () => { controller.current?.abort(); URL.revokeObjectURL(source); };
  }, [file]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  const closeEditor = useCallback(() => {
    if (closeTimer.current) return;
    controller.current?.abort(); setClosing(true);
    closeTimer.current = setTimeout(onClose, 100);
  }, [onClose]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeEditor(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [closeEditor]);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !size.width) return;
    c.width = size.width; c.height = size.height;
    const ctx = c.getContext('2d')!;
    for (const stroke of strokes) {
      ctx.strokeStyle = stroke.color; ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.width * size.width / 600; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      stroke.points.forEach((p, i) => i ? ctx.lineTo(p.x * size.width, p.y * size.height) : ctx.moveTo(p.x * size.width, p.y * size.height));
      ctx.stroke();
      if (stroke.points.length === 1) { const p = stroke.points[0]; ctx.beginPath(); ctx.arc(p.x * size.width, p.y * size.height, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
    }
  }, [strokes, size]);

  const point = (e: React.PointerEvent): Point => {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) };
  };
  const beginCrop = (e: React.PointerEvent, handle: string) => {
    if (busy || !size.width) return;
    e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { start: point(e), handle, original: { ...crop } };
  };
  const down = (e: React.PointerEvent) => {
    if (busy || !size.width) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    const start = point(e);
    if (mode === 'draw') { const stroke = { color, width: brush, points: [start] }; drag.current = { start, stroke }; setStrokes(s => [...s, stroke]); }
    else if (start.x >= crop.x && start.x <= crop.x + crop.width && start.y >= crop.y && start.y <= crop.y + crop.height) drag.current = { start, handle: 'move', original: { ...crop } };
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = point(e);
    if (drag.current.stroke) {
      const stroke = drag.current.stroke;
      const previous = stroke.points[stroke.points.length - 1]; stroke.points.push(p);
      const ctx = canvas.current?.getContext('2d');
      if (ctx) { ctx.strokeStyle = stroke.color; ctx.lineWidth = stroke.width * size.width / 600;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        ctx.moveTo(previous.x * size.width, previous.y * size.height); ctx.lineTo(p.x * size.width, p.y * size.height); ctx.stroke(); }
    }
    else if (drag.current.original && drag.current.handle) {
      const original = drag.current.original, handle = drag.current.handle;
      const dx = p.x - drag.current.start.x, dy = p.y - drag.current.start.y;
      const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
      if (handle === 'move') { setCrop({ ...original, x: clamp(original.x + dx, 0, 1 - original.width), y: clamp(original.y + dy, 0, 1 - original.height) }); return; }
      let left = original.x, top = original.y, right = left + original.width, bottom = top + original.height;
      const minWidth = 2 / size.width, minHeight = 2 / size.height;
      if (handle.includes('w')) left = clamp(original.x + dx, 0, right - minWidth);
      if (handle.includes('e')) right = clamp(original.x + original.width + dx, left + minWidth, 1);
      if (handle.includes('n')) top = clamp(original.y + dy, 0, bottom - minHeight);
      if (handle.includes('s')) bottom = clamp(original.y + original.height + dy, top + minHeight, 1);
      setCrop({ x: left, y: top, width: right - left, height: bottom - top });
    }
  };
  const save = async () => {
    if (!canvas.current || !size.width || crop.width * size.width < 2 || crop.height * size.height < 2) { setError('Выберите область размером хотя бы 2 × 2 пикселя.'); return; }
    setBusy(true); setError(''); controller.current = new AbortController();
    try {
      let edited: File;
      if (isVideo) {
        const form = new FormData(); form.append('File', file);
        form.append('FrameWidth', String(size.width)); form.append('FrameHeight', String(size.height));
        for (const [key, value] of Object.entries(crop)) form.append(key, String(value));
        const response = await apiClient.post('api/MediaDraft/edit-video', form, { responseType: 'blob', signal: controller.current.signal, timeout: 600000 });
        edited = new File([response.data], file.name.replace(/\.[^.]+$/, '') + '-edited.mp4', { type: 'video/mp4' });
      } else {
        const full = document.createElement('canvas'); full.width = size.width; full.height = size.height;
        const ctx = full.getContext('2d')!; ctx.drawImage(image.current!, 0, 0, size.width, size.height); ctx.drawImage(canvas.current, 0, 0);
        const output = document.createElement('canvas'); output.width = Math.max(2, Math.floor(crop.width * size.width)); output.height = Math.max(2, Math.floor(crop.height * size.height));
        output.getContext('2d')!.drawImage(full, Math.floor(crop.x * size.width), Math.floor(crop.y * size.height), output.width, output.height, 0, 0, output.width, output.height);
        const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(b => b ? resolve(b) : reject(new Error('Не удалось сохранить изображение.')), 'image/png'));
        edited = new File([blob], file.name.replace(/\.[^.]+$/, '') + '-edited.png', { type: 'image/png' });
        (edited as any).width = output.width; (edited as any).height = output.height;
      }
      if (!controller.current.signal.aborted) { await onDone(edited); closeEditor(); }
    } catch (e: any) { if (!controller.current?.signal.aborted) setError(e?.message || 'Не удалось сохранить изменения.'); }
    finally { setBusy(false); }
  };
  const mediaStyle: React.CSSProperties = { display: 'block', width: '100%', height: '100%', objectFit: 'contain' };
  return createPortal(<div className={`attachment-editor-overlay ${closing ? 'is-closing' : 'is-open'}`} role="dialog" aria-modal="true" aria-label="Редактор вложения" style={{ position: 'fixed', inset: 0, zIndex: 1000000, background: 'rgba(0,0,0,.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24, boxSizing: 'border-box' }}>
    <section className="attachment-media-editor" style={{ width: 850, maxWidth: '100%', maxHeight: 'calc(100dvh - 48px)', overflow: 'auto', background: 'var(--surface-panel, #161A23)', color: 'var(--text-body, #FFF)', borderRadius: 12, padding: '20px 24px 16px', boxShadow: '0 4px 28px var(--shadow-colour, rgba(0,0,0,.35))', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes attachment-editor-enter { from { opacity: 0; } to { opacity: 1; } }
        @keyframes attachment-editor-exit { from { opacity: 1; } to { opacity: 0; } }
        .attachment-editor-overlay.is-open { animation: attachment-editor-enter 120ms ease-out both; }
        .attachment-editor-overlay.is-closing { animation: attachment-editor-exit 100ms linear both; pointer-events: none; }
        .attachment-media-editor { font-family: 'Segoe UI', sans-serif; }
        .attachment-media-editor button { min-height: 32px; height: 32px; border: 0; border-radius: 8px; padding: 0 12px; color: #7D8494; background: transparent; font: 500 13px 'Segoe UI', sans-serif; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
        .attachment-media-editor button:hover { background: var(--surface-hover, rgba(255,255,255,.08)); color: var(--text-body, #FFF); }
        .attachment-media-editor button[aria-pressed=true] { background: var(--surface-hover, #2E3646); color: var(--text-body, #FFF); }
        .attachment-media-editor footer button { height: 36px; font-size: 13.5px; padding: 0 16px; }
        .attachment-media-editor footer button:last-child { background: var(--accent-primary, #1E9BEB); color: #FFF; font-weight: 600; padding: 0 22px; }
        .attachment-media-editor button:disabled { opacity: .4; cursor: default; }
        .attachment-media-editor .editor-close { width: 28px; height: 28px; min-height: 28px; border-radius: 50%; padding: 0; }
        .attachment-media-editor .editor-colour { width: 28px; height: 28px; min-height: 28px; border-radius: 50%; padding: 3px; border: 2px solid transparent; background: transparent; }
        .attachment-media-editor .editor-colour[aria-pressed=true] { border-color: var(--accent-primary, #1E9BEB); background: transparent; }
        .attachment-media-editor .editor-colour span { width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--surface-hover, rgba(255,255,255,.15)); }
        .attachment-media-editor input[type=range] { width: 110px; height: 3px; appearance: none; background: var(--surface-hover, #333E4A); border-radius: 2px; accent-color: var(--accent-primary, #1E9BEB); }
        .attachment-media-editor input[type=range]::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; background: var(--accent-primary, #1E9BEB); border-radius: 50%; cursor: pointer; }
        .attachment-media-editor input[type=range]::-moz-range-thumb { width: 12px; height: 12px; border: 0; background: var(--accent-primary, #1E9BEB); border-radius: 50%; }
      `}</style>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15 }}><strong style={{ fontSize: 18, fontWeight: 600 }}>{isVideo ? 'Редактирование видео' : 'Редактирование фото'}</strong><button className="editor-close" title="Закрыть" onClick={closeEditor}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12Z"/></svg></button></header>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        {!isVideo && <button aria-pressed={mode === 'draw'} onClick={() => setMode(mode === 'draw' ? 'crop' : 'draw')}>Рисовать</button>}
        {!isVideo && <><span style={{ width: 1, height: 20, background: 'var(--surface-hover, #283040)', margin: '0 4px' }} />
          {['#FFFFFF','#171717','#FF3B30','#FFCC00','#34C759','#007AFF','#AF52DE'].map(value => <button key={value} className="editor-colour" title={`Цвет ${value}`} aria-label={`Цвет ${value}`} aria-pressed={color === value} onClick={() => setColor(value)}><span style={{ background: value }} /></button>)}
          <input aria-label="Толщина кисти" type="range" min="1" max="24" value={brush} onChange={e => setBrush(Number(e.target.value))} /><span style={{ fontSize: 12, color: 'var(--text-secondary, #7D8494)', minWidth: 24 }}>{brush}</span>
          <button disabled={!strokes.length || busy} onClick={() => setStrokes(s => s.slice(0, -1))}>Отменить штрих</button></>}
      </div>
      <div style={{ position: 'relative', width: size.width ? `min(740px, calc(52dvh * ${size.width / size.height}))` : 420, maxWidth: '100%', aspectRatio: `${size.width || 4}/${size.height || 3}`, margin: 'auto', background: 'var(--surface-recessed, #10141B)', borderRadius: 8, overflow: 'hidden' }}>
        {!url ? <div style={{ padding: 30, color: 'var(--text-secondary, #7D8494)' }}>Загрузка…</div> : isVideo && !isGif ? <video ref={video} src={url} style={mediaStyle} muted playsInline onLoadedMetadata={e => { setError(''); setSize({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight }); }} onError={() => setError('Не удалось открыть это видео в браузере.')} /> : <img ref={image} src={url} alt="" style={mediaStyle} onLoad={e => { setError(''); setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight }); }} onError={() => setError('Не удалось открыть изображение.')} />}
        <canvas ref={canvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: mode === 'draw' ? 'crosshair' : 'move' }} onPointerDown={down} onPointerMove={move} onPointerUp={() => { if (drag.current?.stroke) setStrokes(s => [...s]); drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
        <div style={{ position: 'absolute', pointerEvents: 'none', left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%`, border: '1.5px solid #FFFFFF', boxSizing: 'border-box', boxShadow: '0 0 0 100vmax var(--shadow-colour, rgba(0,0,0,.45))' }} />
        {(['nw','n','ne','e','se','s','sw','w'] as const).map(handle => {
          const x = handle.includes('w') ? crop.x : handle.includes('e') ? crop.x + crop.width : crop.x + crop.width / 2;
          const y = handle.includes('n') ? crop.y : handle.includes('s') ? crop.y + crop.height : crop.y + crop.height / 2;
          const cursor = handle === 'n' || handle === 's' ? 'ns-resize' : handle === 'e' || handle === 'w' ? 'ew-resize' : handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize';
          return <span key={handle} data-crop-handle={handle} title="Потяните границу для обрезки"
            onPointerDown={e => beginCrop(e, handle)} onPointerMove={move}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
            style={{ position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, transform: 'translate(-50%,-50%)', width: 16, height: 16, borderRadius: 3, background: '#FFFFFF', border: '1px solid var(--border-primary, #333E4A)', boxSizing: 'border-box', cursor, touchAction: 'none' }} />;
        })}
      </div>
      {isVideo && !isGif && <div style={{ marginTop: 10 }}><button onClick={() => video.current?.paused ? void video.current.play().catch(() => {}) : video.current?.pause()}>▶ / ❚❚</button><button onClick={() => { if (video.current) video.current.muted = !video.current.muted; }}>Звук</button><input aria-label="Позиция видео" type="range" min="0" max="1000" defaultValue="0" onChange={e => { if (video.current?.duration) video.current.currentTime = Number(e.target.value) / 1000 * video.current.duration; }} /></div>}
      {error && <p role="alert" style={{ color: 'var(--danger-text, #FF6B6B)' }}>{error}</p>}
      <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 15 }}><button onClick={() => { closeEditor(); }}>Отмена</button><button disabled={busy || !size.width} onClick={() => void save()}>{busy ? 'Сохранение…' : 'Готово'}</button></footer>
    </section>
  </div>, document.body);
}
