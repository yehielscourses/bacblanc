/** @typedef {{ id: number, numero_original: string, theme_id: string, theme_nom: string, enonce: string, reponses: { lettre: string, texte: string }[], bonne_reponse: string, explication: string }} Question */

export const SERIES_LENGTH = 42;
export const UNLIMITED_WINDOW = 100;
export const THEME_WINDOW = 20;
export const THEME_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export function getBasePath() {
  const meta = document.querySelector('meta[name="base-path"]');
  const fromMeta = meta?.getAttribute('content')?.trim();
  if (fromMeta) return fromMeta.endsWith('/') ? fromMeta : `${fromMeta}/`;
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts.length <= 1) return '/';
  return `/${parts[0]}/`;
}

export function assetUrl(relative) {
  const base = getBasePath();
  const path = relative.replace(/^\//, '');
  return `${base}${path}`;
}
