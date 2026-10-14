import { apiClient, BASE_SERVER_URL } from './apiClient';

const attempts = new WeakMap<Element, string>();
const requests = new Map<string, Promise<string>>();
document.addEventListener('error', event => {
  const target = event.target;
  if (!(target instanceof HTMLImageElement) && !(target instanceof HTMLMediaElement)) return;
  const source = target.currentSrc || target.src;
  if (!source) return;
  let url: URL; try { url = new URL(source, location.href); } catch { return; }
  if (url.origin !== new URL(BASE_SERVER_URL).origin || !/^\/api\/media\/(attachments|thumbnails)\//.test(url.pathname)) return;
  if (attempts.get(target) === source) return;
  attempts.set(target, source);
  let request = requests.get(url.pathname);
  if (!request) {
    request = apiClient.post<{ url: string }>('api/media/refresh-path', JSON.stringify(url.pathname))
      .then(r => new URL(r.data.url, BASE_SERVER_URL).href).finally(() => requests.delete(url.pathname));
    requests.set(url.pathname, request);
  }
  void request.then(fresh => {
    if ((target.currentSrc || target.src) !== source || fresh === source) return;
    attempts.set(target, fresh);
    const playing = target instanceof HTMLMediaElement && !target.paused;
    target.src = fresh;
    if (target instanceof HTMLMediaElement) { target.load(); if (playing) void target.play().catch(() => {}); }
  }).catch(() => {});
}, true);
