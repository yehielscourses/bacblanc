/** @typedef {{ id: number, numero_original: string, theme_id: string, theme_nom: string, enonce: string, reponses: { lettre: string, texte: string }[], bonne_reponse: string, explication: string }} Question */

export const SERIES_LENGTH = 42;
export const UNLIMITED_WINDOW = 100;
export const THEME_WINDOW = 20;
export const THEME_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

let cachedBasePath = null;

/**
 * Déduit la racine du site à partir de l'URL réelle de app.js (fiable en local et sur GitHub Pages).
 */
export function getBasePath() {
  if (cachedBasePath !== null) return cachedBasePath;

  const script = document.querySelector('script[type="module"][src*="app.js"]');
  if (script) {
    try {
      const url = new URL(script.getAttribute('src') || '', location.href);
      const match = url.pathname.match(/^(.*\/)js\/app\.js$/);
      if (match) {
        cachedBasePath = match[1];
        return cachedBasePath;
      }
    } catch {
      /* ignore */
    }
  }

  const meta = document.querySelector('meta[name="base-path"]');
  const fromMeta = meta?.getAttribute('content')?.trim();
  if (fromMeta) {
    cachedBasePath = fromMeta.endsWith('/') ? fromMeta : `${fromMeta}/`;
    return cachedBasePath;
  }

  const parts = location.pathname.split('/').filter(Boolean);
  if (parts.length === 0) {
    cachedBasePath = '/';
    return cachedBasePath;
  }

  cachedBasePath = `/${parts[0]}/`;
  return cachedBasePath;
}

export function assetUrl(relative) {
  const base = getBasePath();
  const path = relative.replace(/^\//, '');
  if (base === '/') return `/${path}`;
  return `${base}${path}`;
}
